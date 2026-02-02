"""
LLM Service Entry Point
- gRPC 서버 (50051 포트) 실행
"""
import sys
import threading
from service.grpc_handler import serve_grpc
from utils.log_format import log_json

if __name__ == "__main__":
    try:
        # gRPC 서버를 메인 스레드에서 실행 (블로킹)
        log_json("llm_service_starting")
        serve_grpc()
    except KeyboardInterrupt:
        log_json("llm_service_shutting_down")
        sys.exit(0)
