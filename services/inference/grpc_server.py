"""
gRPC Server for Inference Service
TTS (Text-to-Speech) 스트리밍 서비스
"""
import grpc
from concurrent import futures
import logging
import os
import sys

# proto 파일에서 생성된 모듈 import
# grpcio-tools로 생성: python -m grpc_tools.protoc -I../proto --python_out=. --grpc_python_out=. ../proto/inference.proto
try:
    import inference_pb2
    import inference_pb2_grpc
except ImportError:
    print("ERROR: proto 파일이 컴파일되지 않았습니다.")
    print("실행: python -m grpc_tools.protoc -I../proto --python_out=. --grpc_python_out=. ../proto/inference.proto")
    sys.exit(1)

from tts_service import generate_tts_openai, generate_tts_edge
import asyncio

logging.basicConfig(
    level=logging.INFO,
    format='{"service": "inference-grpc", "timestamp": "%(asctime)s", "level": "%(levelname)s", "message": "%(message)s"}'
)
logger = logging.getLogger(__name__)


class InferenceServicer(inference_pb2_grpc.InferenceServiceServicer):
    """
    gRPC Inference Service 구현
    """
    
    def TextToSpeech(self, request, context):
        """
        TTS 스트리밍 응답
        클라이언트는 여러 청크를 받아서 조합
        """
        try:
            logger.info(f"TTS gRPC 요청: mode={request.mode}, text_length={len(request.text)}, persona={request.persona}")
            
            # TTS 생성 (동기 함수로 래핑)
            if request.mode == "practice":
                # Edge-TTS (비동기)
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    audio_bytes = loop.run_until_complete(
                        generate_tts_edge(request.text, voice="ko-KR-SunHiNeural")
                    )
                finally:
                    loop.close()
            else:
                # OpenAI TTS (동기)
                audio_bytes = generate_tts_openai(
                    request.text,
                    persona=request.persona or "COMFORTABLE",
                    speed=request.speed or 1.0
                )
            
            # 청크 단위로 스트리밍 (1MB씩)
            CHUNK_SIZE = 1024 * 1024  # 1MB
            total_size = len(audio_bytes)
            
            logger.info(f"TTS 생성 완료: {total_size} bytes, {total_size // CHUNK_SIZE + 1} chunks")
            
            for i in range(0, total_size, CHUNK_SIZE):
                chunk = audio_bytes[i:i + CHUNK_SIZE]
                is_final = (i + CHUNK_SIZE >= total_size)
                
                yield inference_pb2.TTSChunk(
                    audio_data=chunk,
                    is_final=is_final
                )
            
            logger.info("TTS 스트리밍 완료")
        
        except Exception as e:
            logger.error(f"TTS gRPC 오류: {str(e)}", exc_info=True)
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"TTS 생성 실패: {str(e)}")
            return


def serve():
    """
    gRPC 서버 시작
    """
    port = os.getenv('GRPC_PORT', '50051')
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    
    inference_pb2_grpc.add_InferenceServiceServicer_to_server(
        InferenceServicer(), server
    )
    
    server.add_insecure_port(f'[::]:{port}')
    server.start()
    
    logger.info(f"✅ Inference gRPC 서버 시작: 0.0.0.0:{port}")
    
    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        logger.info("gRPC 서버 종료 중...")
        server.stop(0)


if __name__ == '__main__':
    serve()
