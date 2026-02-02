from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, Response
from datetime import datetime
import time
from dotenv import load_dotenv
from openai import OpenAI
import os
from pydantic import BaseModel
import json
from uuid import uuid4
from typing import Literal
import socket
import redis

# TTS 서비스 임포트
from tts_service import generate_tts_openai, generate_tts_edge, get_random_filler


# .env 파일 로드
load_dotenv()

app = FastAPI()

# OpenAI 클라이언트 생성
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Kafka 설정
KAFKA_BROKER = os.getenv('KAFKA_BROKER', 'kafka:29092')
GRPC_PORT = os.getenv('GRPC_PORT', '50051')

# Redis 설정 (STT 서비스용)
REDIS_HOST = os.getenv('REDIS_HOST', 'redis')
REDIS_PORT = int(os.getenv('REDIS_PORT', '6379'))
REDIS_DB = int(os.getenv('REDIS_DB', '1'))  # STT는 DB 1 사용

def log_json(event: str, **fields) -> None:
    """
    JSON 포맷으로 표준화된 로그를 출력합니다.
    """
    base = {
        "service": "llm",
        "event": event,
        "timestamp": datetime.now().isoformat(),
    }
    base.update(fields)
    print(json.dumps(base, ensure_ascii=False), flush=True)


def get_trace_id(request: Request) -> str:
    """
    요청 컨텍스트에서 trace-id를 추출합니다.
    - HTTP 미들웨어에서 request.state.trace_id에 설정한 값을 우선 사용합니다.
    - 없으면 헤더의 x-trace-id를 사용합니다.
    """
    trace_id = getattr(request.state, "trace_id", None)
    if trace_id:
        return trace_id
    return request.headers.get("x-trace-id", "")


@app.middleware("http")
async def trace_and_access_log(request: Request, call_next):
    """
    AOP 스타일 HTTP 미들웨어
    - 요청당 traceId를 생성/전파하고,
    - 요청/응답 메타데이터를 공통 포맷으로 로깅합니다.
    """
    start = time.time()
    # 이미 상위 계층에서 전달된 traceId가 있으면 사용
    incoming_trace_id = request.headers.get("x-trace-id")
    trace_id = incoming_trace_id or str(uuid4())
    request.state.trace_id = trace_id

    response = await call_next(request)

    duration_ms = int((time.time() - start) * 1000)
    response.headers["x-trace-id"] = trace_id

    log_json(
        "http_request",
        traceId=trace_id,
        path=request.url.path,
        method=request.method,
        status=response.status_code,
        latencyMs=duration_ms,
    )

    return response


class UserRequest(BaseModel):
    user_answer: str

@app.post("/interview")  # GET -> POST로 변경 (데이터를 받아야 하므로)
def interview_stream(request: UserRequest, http_request: Request):
    trace_id = get_trace_id(http_request)

    log_json(
        "interview_request_received",
        traceId=trace_id,
        answerLength=len(request.user_answer),
    )

    def generate_openai_response():
        # 1. GPT에게 보낼 메시지 구성
        messages = [
            {
                "role": "system",
                "content": (
                    "너는 10년 차 IT 개발자 면접관이다. "
                    "지원자의 답변을 듣고, 내용이 빈약하거나 기술적으로 모호한 부분을 찾아 "
                    "날카로운 꼬리 질문을 한 가지만 짧게(한 문장으로) 물어봐라. "
                    "존댓말을 사용해라."
                )
            },
            {
                "role": "user",
                "content": request.user_answer
            }
        ]

        # 2. OpenAI API 호출 (스트리밍 모드)
        model = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
        stream = client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
        )

        # 3. 한 글자씩 받아서 yield
        for chunk in stream:
            if chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                log_json(
                    "interview_stream_chunk",
                    traceId=trace_id,
                    chunkLength=len(content),
                )
                yield content

        log_json(
            "interview_stream_finished",
            traceId=trace_id,
        )

    # 스트리밍 응답 반환
    return StreamingResponse(generate_openai_response(), media_type="text/plain")

@app.get("/ping")
async def get_ping():
    return {
        "message": "Python API is running",
        "timestamp": datetime.now().isoformat(),
    }


def check_tcp_port(host: str, port: int, timeout: float = 2.0) -> bool:
    """지정된 호스트와 포트에 TCP 연결을 시도합니다."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False


@app.get("/health")
async def get_health():
    start_time = time.time()
    checks = {}
    overall_status = "healthy"

    # 1. FastAPI 서버 자체는 이 엔드포인트가 응답하면 OK
    checks["fastapi"] = "ok"

    # 2. gRPC 서버 포트 확인
    grpc_host = "localhost"  # supervisord.conf에 따라 같은 Pod 내에서 실행
    grpc_port = int(GRPC_PORT)
    if check_tcp_port(grpc_host, grpc_port):
        checks["grpc_server"] = "ok"
    else:
        checks["grpc_server"] = "port_closed"
        overall_status = "degraded"
        log_json("health_check_grpc_failed", reason="port_closed", host=grpc_host, port=grpc_port)

    # 3. Kafka 연결 확인
    kafka_status = "ok"
    try:
        # Kafka 브로커 주소 파싱 (host:port 형태)
        kafka_host, kafka_port_str = KAFKA_BROKER.split(':')
        kafka_port = int(kafka_port_str)
        if not check_tcp_port(kafka_host, kafka_port):
            kafka_status = "unreachable"
            overall_status = "degraded"
            log_json("health_check_kafka_failed", reason="unreachable", broker=KAFKA_BROKER)
    except ValueError:
        kafka_status = "invalid_config"
        overall_status = "degraded"
        log_json("health_check_kafka_failed", reason="invalid_config", broker=KAFKA_BROKER)
    except Exception as e:
        kafka_status = f"error: {str(e)}"
        overall_status = "degraded"
        log_json("health_check_kafka_failed", reason="exception", error=str(e), broker=KAFKA_BROKER)
    checks["kafka_broker"] = kafka_status

    # 4. Redis 연결 확인 (STT 서비스용)
    redis_status = "ok"
    try:
        # Redis 클라이언트 생성 시 timeout 설정
        redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, socket_connect_timeout=2.0)
        redis_client.ping()  # 연결 확인
        checks["redis_stt"] = "ok"
    except redis.exceptions.ConnectionError as e:
        redis_status = "unreachable"
        overall_status = "degraded"
        log_json("health_check_redis_failed", reason="unreachable", host=REDIS_HOST, port=REDIS_PORT, error=str(e))
    except Exception as e:
        redis_status = f"error: {str(e)}"
        overall_status = "degraded"
        log_json("health_check_redis_failed", reason="exception", error=str(e), host=REDIS_HOST, port=REDIS_PORT)
    checks["redis_stt"] = redis_status

    response_time_ms = int((time.time() - start_time) * 1000)
    log_json("health_check_completed", status=overall_status, checks=checks, latencyMs=response_time_ms)

    return {
        "status": overall_status,
        "timestamp": datetime.now().isoformat(),
        "service": "llm",
        "checks": checks
    }

@app.get("/stream")
def stream_response():
  # media_type을 text/plain으로 명시해야 브라우저/Node가 단순 텍스트로 인식합니다.
  return StreamingResponse(fake_ai_generator(), media_type="text/plain")

def fake_ai_generator():
    # 🚨 실수하기 쉬운 부분:
    # text = ["안", "녕", ...]  <-- 이렇게 리스트로 되어 있거나
    # yield text                <-- 리스트를 통째로 yield 하면 안 됩니다!
    
    # ✅ 올바른 코드: 긴 문자열 하나여야 함
    text = "안녕하세요. 이것은 Python에서 보내는 실시간 스트리밍 테스트입니다. 타자기처럼 글자가 보이나요? 끝."
    
    for char in text:
        yield char  # ✅ 한 글자씩 '문자열'로 뱉어야 합니다.
        time.sleep(0.1) # 0.1초 딜레이 (이게 없으면 너무 빨라서 한 번에 뜬 것처럼 보임)


# =============================================================================
# TTS (Text-to-Speech) API
# =============================================================================

class TTSRequest(BaseModel):
    text: str
    mode: Literal["practice", "real"] = "practice"  # 연습 or 실전
    persona: Literal["PRESSURE", "COMFORTABLE", "RANDOM"] = "COMFORTABLE"
    speed: float = 1.0


@app.post("/tts")
async def text_to_speech(request: TTSRequest, http_request: Request):
    """
    텍스트를 음성으로 변환하는 하이브리드 TTS 엔드포인트
    
    - 실전 면접 (mode=real): OpenAI TTS API (감정 표현, 페르소나)
    - 연습 모드 (mode=practice): Edge-TTS (무료, MS Azure급 품질)
    """
    trace_id = get_trace_id(http_request)
    
    log_json(
        "tts_request_received",
        traceId=trace_id,
        mode=request.mode,
        persona=request.persona,
        textLength=len(request.text),
    )
    
    try:
        if request.mode == "real":
            # 실전 면접: OpenAI TTS
            audio_bytes = generate_tts_openai(
                text=request.text,
                persona=request.persona,
                speed=request.speed
            )
            
            return Response(
                content=audio_bytes,
                media_type="audio/mpeg",
                headers={
                    "X-TTS-Engine": "openai",
                    "X-TTS-Persona": request.persona,
                    "X-Trace-Id": trace_id,
                }
            )
        else:
            # 연습 모드: Edge-TTS (실패 시 OpenAI Fallback)
            try:
                audio_bytes = await generate_tts_edge(
                    text=request.text,
                    voice="ko-KR-SunHiNeural",
                )
                
                return Response(
                    content=audio_bytes,
                    media_type="audio/mpeg",
                    headers={
                        "X-TTS-Engine": "edge-tts",
                        "X-TTS-Cost": "0",
                        "X-Trace-Id": trace_id,
                    }
                )
            except Exception as edge_error:
                # Edge-TTS 실패 시 OpenAI로 Fallback
                log_json(
                    "edge_tts_fallback_to_openai",
                    traceId=trace_id,
                    error=str(edge_error),
                    reason="Edge-TTS 403 or network issue"
                )
                
                audio_bytes = generate_tts_openai(
                    text=request.text,
                    persona="COMFORTABLE",  # 연습 모드는 편안한 톤
                    speed=request.speed
                )
                
                return Response(
                    content=audio_bytes,
                    media_type="audio/mpeg",
                    headers={
                        "X-TTS-Engine": "openai-fallback",
                        "X-TTS-Cost": "fallback",
                        "X-Trace-Id": trace_id,
                        "X-Warning": "Edge-TTS unavailable, using OpenAI"
                    }
                )
    
    except Exception as e:
        log_json(
            "tts_request_failed",
            traceId=trace_id,
            error=str(e),
            mode=request.mode,
        )
        return Response(
            content=json.dumps({"error": str(e)}),
            status_code=500,
            media_type="application/json"
        )


@app.get("/tts/filler")
async def get_filler_word(http_request: Request):
    """
    랜덤 필러 워드 반환 (즉각 반응용)
    캐싱된 오디오 파일명을 반환하거나, 즉시 생성
    """
    trace_id = get_trace_id(http_request)
    
    filler_text = get_random_filler()
    
    log_json(
        "filler_word_requested",
        traceId=trace_id,
        fillerText=filler_text,
    )
    
    return {
        "text": filler_text,
        "audioUrl": f"/assets/tts/filler_{hash(filler_text) % 1000}.mp3",
        "traceId": trace_id,
    }


@app.get("/tts/voices")
async def list_voices():
    """
    사용 가능한 TTS 음성 목록 반환
    """
    return {
        "openai": {
            "PRESSURE": "onyx",
            "COMFORTABLE": "nova",
            "RANDOM": "alloy",
        },
        "edge": {
            "female_formal": "ko-KR-SunHiNeural",
            "male_formal": "ko-KR-InJoonNeural",
            "female_casual": "ko-KR-SoonBokMultilingualNeural",
        }
    }