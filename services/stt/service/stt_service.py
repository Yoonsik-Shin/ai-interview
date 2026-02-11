import grpc
from concurrent import futures
from generated.stt.v1 import stt_pb2_grpc
from service.worker.audio_request_worker import process_audio_request
from config import GRPC_PORT

"""
STT 비즈니스 로직 계층
 - gRPC 요청 처리
 - 오디오 청크 수집 및 VAD
 - 엔진 선택 및 후처리
"""



from grpc_health.v1 import health
from grpc_health.v1 import health_pb2
from grpc_health.v1 import health_pb2_grpc

class SttServiceServicer(stt_pb2_grpc.SttServiceServicer):
    def SpeechToText(self, request_iterator, context):
        response = process_audio_request(request_iterator)

        if response.engine == "error":
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details("STT processing failed")

        return response


def serve_grpc():
    """
    gRPC 서버 실행 함수
    """
    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=10),
        options=[
            ("grpc.keepalive_time_ms", 10000),
            ("grpc.keepalive_timeout_ms", 5000),
            ("grpc.keepalive_permit_without_calls", True),
            ("grpc.http2.max_pings_without_data", 0),
            ("grpc.http2.min_time_between_pings_ms", 5000),
            ("grpc.http2.min_ping_interval_without_data_ms", 5000),
        ]
    )
    stt_pb2_grpc.add_SttServiceServicer_to_server(SttServiceServicer(), server)
    
    # Health Check Servicer 등록
    health_servicer = health.HealthServicer(
        experimental_non_blocking=True,
        experimental_thread_pool=futures.ThreadPoolExecutor(max_workers=10),
    )
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)

    # 서비스 상태 설정 (""는 전체 서버 상태)
    health_servicer.set("", health_pb2.HealthCheckResponse.SERVING)
    health_servicer.set("stt.SttService", health_pb2.HealthCheckResponse.SERVING)
    
    # Secure Port 또는 Insecure Port 설정 (내부 통신이므로 Insecure 사용)
    server.add_insecure_port(f"[::]:{GRPC_PORT}")
    
    print(f"STT gRPC Server started on port {GRPC_PORT}")
    server.start()
    server.wait_for_termination()

