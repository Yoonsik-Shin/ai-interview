from fastapi import FastAPI, Request
from datetime import datetime
from fastapi.responses import StreamingResponse
import time
from dotenv import load_dotenv
from openai import OpenAI
import os
from pydantic import BaseModel
import json
from uuid import uuid4


# .env 파일 로드
load_dotenv()

app = FastAPI()

# OpenAI 클라이언트 생성
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def log_json(event: str, **fields) -> None:
    """
    JSON 포맷으로 표준화된 로그를 출력합니다.
    """
    base = {
        "service": "inference",
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


@app.get("/health")
async def get_health():
    return {"status": "ok"}

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