"""
gRPC Servicer - OpenAI API 응답을 그대로 스트리밍
"""
import grpc
from concurrent import futures
from grpc_health.v1 import health
from grpc_health.v1 import health_pb2
from grpc_health.v1 import health_pb2_grpc
import llm_pb2
import llm_pb2_grpc
from engine.openai_engine import OpenAIEngine
from config import GRPC_PORT
from utils.log_format import log_json


class LlmServicer(llm_pb2_grpc.LlmServiceServicer):
    def __init__(self):
        self.engine = OpenAIEngine()

    def GenerateResponse(self, request, context):
        """OpenAI API 응답을 그대로 스트리밍"""
        try:
            log_json(
                "llm_request_start",
                interviewId=request.interview_id,
                textLength=len(request.user_text),
            )

            # 히스토리 변환
            history = [{"role": h.role, "content": h.content} for h in request.history]
            log_json("llm_history_converted", count=len(history))

            # 신규 필드 추출 (proto에 추가됨)
            stage = request.stage
            persona = request.persona or "COMFORTABLE"
            interviewer_count = request.interviewer_count if request.HasField("interviewer_count") else 1
            domain = request.domain or "IT"

            # 스트리밍 (Thinking 상태 시뮬레이션 - Stage별로 차별화 가능)
            thinking_messages = ["질문을 분석 중입니다..."]
            if stage == 2: # GREETING
                thinking_messages = ["지원을 환영하고 있습니다..."]
            elif stage == 3: # INTERVIEWER_INTRO
                thinking_messages = ["면접관 자기소개를 준비 중입니다..."]
            elif stage == 4: # SELF_INTRO
                thinking_messages = ["자기소개를 경청하고 있습니다..."]
            elif stage == 5: # IN_PROGRESS
                thinking_messages = ["답변을 분석 중입니다..."]


            log_json("llm_thinking_start", stage=stage)
            for msg in thinking_messages:
                yield llm_pb2.TokenChunk(
                    token="",
                    is_sentence_end=False,
                    is_final=False,
                    thinking=msg
                )
                import time
                time.sleep(0.3)
            
            log_json("llm_openai_stream_start")

            # 스트리밍 (OpenAI 응답 흘려줌)
            accumulated = ""
            token_count = 0

            for token in self.engine.generate_stream(
                request.user_text, 
                history, 
                stage=stage, 
                persona=persona, 
                interviewer_count=interviewer_count, 
                domain=domain
            ):
                if token_count == 0:
                     log_json("llm_first_token_received")
                
                token_count += 1
                accumulated += token
                is_sentence_end = self.engine.is_sentence_end(accumulated)

                yield llm_pb2.TokenChunk(
                    token=token,
                    is_sentence_end=is_sentence_end,
                    is_final=False,
                    thinking="",
                )

                if is_sentence_end:
                    accumulated = ""

            # 최종 완료
            yield llm_pb2.TokenChunk(
                token="", is_final=True, is_sentence_end=False, thinking=""
            )

            log_json(
                "llm_request_completed",
                interviewId=request.interview_id,
                totalTokens=token_count,
            )

        except Exception as e:
            log_json("llm_error", error=str(e), error_type=type(e).__name__)
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"{type(e).__name__}: {str(e)}")
            raise e

    def TextToSpeech(self, request, context):
        """TTS는 별도 서비스로 분리 예정"""
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details("TTS moved to separate service")


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
