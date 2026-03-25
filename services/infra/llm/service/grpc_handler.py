"""
gRPC Servicer - OpenAI API 응답을 그대로 스트리밍
"""
import grpc
from concurrent import futures
from grpc_health.v1 import health
from grpc_health.v1 import health_pb2
from grpc_health.v1 import health_pb2_grpc
from llm.v1 import llm_pb2
from llm.v1 import llm_pb2_grpc
from common.v1 import enums_pb2
from config import GRPC_PORT
from utils.log_format import log_json

class LlmServicer(llm_pb2_grpc.LlmServiceServicer):
    def __init__(self):
        # LangGraph & LLM Setup
        from engine.graph import create_interview_graph
        from engine.nodes import InterviewNodes
        from engine.llm_factory import build_chat_llm

        self.llm = build_chat_llm(streaming=True)
        self.graph = create_interview_graph()
        # Helper to get prompt messages
        self.nodes = InterviewNodes(self.llm)

    def GenerateResponse(self, request, context):
        """LangGraph Orchestration & Streaming"""
        try:
            log_json(
                "llm_request_start",
                interviewId=request.interview_id,
            )

            # 1. Construct State
            # (Phase 6) History is now managed by LangGraph Checkpointer (Track 2 Redis),
            # so we only receive the latest user text.
            
            # Map Participating Personas (Direct string list)
            roles = list(request.participating_personas) if request.participating_personas else []

            # Ensure we have at least one valid fallback role
            if not roles:
                roles = ["TECH"]

            # Map domain and company context
            domain_name = request.domain if request.domain else "UNKNOWN"
            company_name = request.company_name if request.company_name else "Unknown Company"

            # Personality is removed, we can default or remove entirely. Defaulting for backward compat
            personality = "COMFORTABLE" 

            state = {
                "interview_id": getattr(request, "interview_id", ""),
                "resume_id": getattr(request, "resume_id", ""),
                "user_input": request.user_text,
                "available_roles": roles,
                "personality": personality,
                "input_role": getattr(request, "input_role", "user"),
                "current_difficulty": request.current_difficulty_level or 3,
                "remaining_time": request.remaining_time_seconds,
                "total_duration": request.scheduled_duration_minutes * 60,
                "last_interviewer_id": request.last_interviewer_id,
                "stage": enums_pb2.InterviewStageProto.Name(request.stage),
                "company_name": company_name,
                "domain": domain_name,
                # Initial internal state
                "is_ending": False,
                "reduce_total_time": False,
                "analysis_result": {}
            }

            # 2. Run Graph (Decision Making) with Checkpoint Config
            log_json("llm_graph_invoke_start")
            config = {"configurable": {"thread_id": request.interview_id}}
            final_state = self.graph.invoke(state, config=config)
            log_json("llm_graph_invoke_end", 
                     next_speaker=final_state.get("next_speaker_id"),
                     next_diff=final_state.get("next_difficulty"))
            
            # 3. Prepare Generation
            messages = self.nodes.get_prompt_messages(final_state)
            
            # 4. Stream Response
            persona_id = final_state.get("next_speaker_id", "LEADER")
            next_diff = final_state.get("next_difficulty", 3)
            reduce_time = final_state.get("reduce_total_time", False)
            is_ending = final_state.get("is_ending", False)

            log_json("llm_stream_start")
            first_chunk = True
            accumulated = ""
            
            for chunk in self.llm.stream(messages):
                token = chunk.content
                if not token:
                    continue
                    
                accumulated += token
                is_sentence_end = (token in [".", "?", "!", "\n"] or 
                                  accumulated.strip().endswith((".", "?", "!"))) 
                
                yield llm_pb2.TokenChunk(
                    token=token,
                    is_sentence_end=is_sentence_end,
                    is_final=False,
                    current_persona_id=persona_id,
                    next_difficulty_level=next_diff,
                    reduce_total_time=reduce_time if first_chunk else False,
                    interview_end_signal=is_ending if first_chunk else False
                )
                
                if is_sentence_end:
                    accumulated = ""
                first_chunk = False

            # Final Chunk
            yield llm_pb2.TokenChunk(
                token="",
                is_final=True,
                is_sentence_end=False,
                current_persona_id=persona_id
            )
            
            # 5. Persist History via Checkpointer Update
            from langchain_core.messages import HumanMessage, AIMessage
            log_json("llm_updating_stateful_history", interviewId=request.interview_id)
            new_history = []
            if request.user_text:
                new_history.append(HumanMessage(content=request.user_text))
            new_history.append(AIMessage(content=accumulated))
            
            self.graph.update_state(config, {"history": new_history})
            
            log_json("llm_request_completed")

        except Exception as e:
            log_json("llm_error", error=str(e), error_type=type(e).__name__)
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"{type(e).__name__}: {str(e)}")
            raise e

    def GenerateReport(self, request, context):
        """면접 리포트 생성 (GPT-4o structured output)"""
        try:
            log_json("llm_generate_report_start", interviewId=request.interview_id, messageCount=len(request.messages))

            from engine.report_engine import generate_report

            messages = [
                {"role": msg.role, "content": msg.content}
                for msg in request.messages
            ]

            result = generate_report(messages)

            log_json("llm_generate_report_completed",
                     interviewId=request.interview_id,
                     totalScore=result["totalScore"],
                     passFailStatus=result["passFailStatus"])

            return llm_pb2.GenerateReportResponse(
                total_score=result["totalScore"],
                pass_fail_status=result["passFailStatus"],
                summary_text=result["summaryText"],
                resume_feedback=result["resumeFeedback"],
            )

        except Exception as e:
            log_json("llm_generate_report_error", error=str(e), error_type=type(e).__name__)
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return llm_pb2.GenerateReportResponse(
                total_score=0,
                pass_fail_status="FAIL",
                summary_text="리포트 생성 중 오류가 발생했습니다.",
                resume_feedback="",
            )

    def ClassifyResume(self, request, context):
        """이력서 여부 판별 (gpt-4o-mini 사용)"""
        try:
            log_json("llm_classify_resume_start", textLength=len(request.text))
            
            from engine.prompts import RESUME_CLASSIFICATION_PROMPT
            from langchain_core.output_parsers import JsonOutputParser
            
            chain = RESUME_CLASSIFICATION_PROMPT | self.llm | JsonOutputParser()
            
            # gpt-4o-mini를 사용하여 빠르게 판별
            result = chain.invoke({"text": request.text})
            
            is_resume = result.get("is_resume", False)
            raw_score = result.get("score")
            
            # 점수 로직 보정: is_resume가 False이면 점수를 강제로 낮춤
            if is_resume:
                score = raw_score if raw_score is not None else 0.95
            else:
                score = 0.1 # 이력서가 아니면 낮은 점수 부여

            log_json("llm_classify_resume_completed", 
                     is_resume=is_resume, 
                     reason=result.get("reason"),
                     score=score)
            
            return llm_pb2.ClassifyResumeResponse(
                is_resume=is_resume,
                reason=result.get("reason", ""),
                score=float(score)
            )
            
        except Exception as e:
            log_json("llm_classify_error", error=str(e))
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return llm_pb2.ClassifyResumeResponse(is_resume=False, reason="서버 오류 발생")


def serve_grpc():
    """gRPC 서버 시작 (STT 패턴)"""
    health_servicer = health.HealthServicer(
        experimental_non_blocking=True,
        experimental_thread_pool=futures.ThreadPoolExecutor(max_workers=10),
    )
    
    # Keepalive Options
    options = [
        ("grpc.keepalive_time_ms", 10000),  # 10초마다 Ping 보냄 (Server -> Client)
        ("grpc.keepalive_timeout_ms", 5000),  # Ping 응답 대기 시간
        ("grpc.keepalive_permit_without_calls", True),  # 활성 호출 없어도 Ping 허용
        ("grpc.http2.max_pings_without_data", 0),  # 데이터 없는 Ping 무제한 허용 (client의 frequent ping 허용)
        ("grpc.http2.min_time_between_pings_ms", 5000),  # 최소 Ping 간격 (Client가 10초마다 보내므로 그보다 작게)
        ("grpc.http2.min_ping_interval_without_data_ms", 5000), # 데이터 없을 때 최소 Ping 간격
    ]

    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=10),
        options=options
    )
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)
    health_servicer.set("", health_pb2.HealthCheckResponse.SERVING)
    health_servicer.set("llm.LlmService", health_pb2.HealthCheckResponse.SERVING)

    llm_pb2_grpc.add_LlmServiceServicer_to_server(LlmServicer(), server)

    server.add_insecure_port(f"[::]:{GRPC_PORT}")

    log_json("grpc_server_starting", port=GRPC_PORT)
    server.start()
    log_json("grpc_server_started", port=GRPC_PORT)

    server.wait_for_termination()
