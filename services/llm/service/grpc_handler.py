"""
gRPC Servicer - OpenAI API 응답을 그대로 스트리밍
"""
import grpc
from concurrent import futures
from grpc_health.v1 import health
from grpc_health.v1 import health_pb2
from grpc_health.v1 import health_pb2_grpc
from generated import llm_pb2
from generated import llm_pb2_grpc
from engine.openai_engine import OpenAIEngine
from config import GRPC_PORT
from utils.log_format import log_json

class LlmServicer(llm_pb2_grpc.LlmServiceServicer):
    def __init__(self):
        # LangGraph & LLM Setup
        # API Key is expected to be in env (OPENAI_API_KEY) or loaded via config
        from config import OPENAI_API_KEY
        from engine.graph import create_interview_graph
        from engine.nodes import InterviewNodes
        from langchain_openai import ChatOpenAI
        
        self.llm = ChatOpenAI(model="gpt-4o-mini", api_key=OPENAI_API_KEY, streaming=True)
        self.graph = create_interview_graph(openai_api_key=OPENAI_API_KEY)
        # Helper to get prompt messages
        self.nodes = InterviewNodes(self.llm)

    def GenerateResponse(self, request, context):
        """LangGraph Orchestration & Streaming"""
        try:
            log_json(
                "llm_request_start",
                interviewId=request.interview_id,
                textLength=len(request.user_text),
            )

            # 1. Construct State
            # Map Proto history to LangChain messages
            from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
            history = []
            for h in request.history:
                role_lower = h.role.lower()
                if role_lower == "user":
                    history.append(HumanMessage(content=h.content))
                elif role_lower == "system":
                    history.append(SystemMessage(content=h.content))
                else:
                    history.append(AIMessage(content=h.content))

            # Map Proto PersonaProfile to Dict or Object
            # We use the repeated field available_personas
            # Deprecated: available = []
            
            # Map Proto Roles (Enum) to Strings
            # request.available_roles is a list of Integers (Enum values)
            roles = []
            for r in request.available_roles:
                role_name = llm_pb2.InterviewRoleProto.Name(r)
                if role_name != "INTERVIEW_ROLE_UNSPECIFIED":
                    roles.append(role_name)

            # Map Personality (Enum) to String
            personality = "COMFORTABLE" # Default
            if request.personality:
                p_name = llm_pb2.InterviewPersonalityProto.Name(request.personality)
                if p_name != "INTERVIEW_PERSONALITY_UNSPECIFIED":
                    personality = p_name

            state = {
                "history": history,
                "user_input": request.user_text,
                "available_roles": roles, # New
                "personality": personality, # New
                "input_role": getattr(request, "input_role", "user"), # New
                "current_difficulty": request.current_difficulty_level or 3,
                "remaining_time": request.remaining_time_seconds,
                "total_duration": request.total_duration_seconds,
                "last_interviewer_id": request.last_interviewer_id,
                "stage": llm_pb2.InterviewStageProto.Name(request.stage),
                # Initial internal state
                "is_ending": False,
                "reduce_total_time": False,
                "analysis_result": {}
            }

            # 2. Run Graph (Decision Making)
            # invoke() is sync, blocks until decision is made
            log_json("llm_graph_invoke_start")
            final_state = self.graph.invoke(state)
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

            # Send Thinking/Meta info (Optional, client might expect 'thinking' field)
            # We can skip specific "thinking" text logic for now or restore it if needed.
            # Let's send one meta chunk to ensure client gets the update even if stream fails later?
            # Or just piggyback on first token.
            
            log_json("llm_stream_start")
            first_chunk = True
            accumulated = ""
            
            for chunk in self.llm.stream(messages):
                token = chunk.content
                if not token:
                    continue
                    
                accumulated += token
                
                # Check sentence end for TTS optimized buffering (Client/Core handles this, 
                # but we need to mark is_sentence_end for Core's buffering logic)
                is_sentence_end = (token in [".", "?", "!", "\n"] or 
                                  accumulated.strip().endswith((".", "?", "!"))) 
                # Simple check, Core has robust logic too? 
                # Ref: Core's logic relies on LLM flagging it? 
                # Previous `grpc_handler` used `engine.is_sentence_end`. 
                # We can implement a simple one here.
                
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
            
            log_json("llm_request_completed")

        except Exception as e:
            log_json("llm_error", error=str(e), error_type=type(e).__name__)
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"{type(e).__name__}: {str(e)}")
            raise e


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
