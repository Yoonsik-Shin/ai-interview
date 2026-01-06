from fastapi import FastAPI
from datetime import datetime
from fastapi.responses import StreamingResponse
import time
from dotenv import load_dotenv
from openai import OpenAI
import os
from pydantic import BaseModel

# .env 파일 로드
load_dotenv()

app = FastAPI()

# OpenAI 클라이언트 생성
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# 요청 바디 정의 (Node.js에서 보낼 데이터)
class UserRequest(BaseModel):
    user_answer: str

@app.post("/interview")  # GET -> POST로 변경 (데이터를 받아야 하므로)
def interview_stream(request: UserRequest):
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
                yield chunk.choices[0].delta.content

    # 스트리밍 응답 반환
    return StreamingResponse(generate_openai_response(), media_type="text/plain")

@app.get("/ping")
async def get_ping():
    return {"message": "Python API is running", "timestamp": datetime.now().isoformat()}

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