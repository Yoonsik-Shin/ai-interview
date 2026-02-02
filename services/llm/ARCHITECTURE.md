# 🎯 LLM Service Architecture

LLM(Large Language Model) 서비스는 Core 서비스로부터 gRPC 스트리밍 요청을 받아 LangGraph 기반 AI 면접관 응답을 생성하고, 실행 과정(THINKING)과 최종 결과를 스트리밍으로 반환합니다.

---

## 1. 📂 파일 구조 (File Structure)

```
llm/
  main.py                # gRPC 서버 엔트리포인트
  pyproject.toml         # 의존성 관리 (uv 기반)
  config.py              # 환경설정 중앙 관리
  Dockerfile             # uv 기반 컨테이너 이미지

  service/
    grpc_handler.py      # gRPC Servicer 구현 (GenerateResponse, TextToSpeech)
    llm_service.py       # LLM 응답 생성 (OpenAI API → 향후 LangGraph)
    context_manager.py   # Redis 기반 대화 맥락 관리
    tts_service.py       # TTS 생성 (OpenAI TTS + Edge-TTS)

  event/
    publisher.py         # Redis Pub/Sub Publisher (향후 제거 예정)
    redis_client.py      # Redis 클라이언트 유틸리티

  utils/
    log_format.py        # JSON 로깅 유틸리티
```

---

## 2. 🚀 실행 방식 (Execution)

- **실행**: `uv run main.py`
  - 단일 프로세스로 **gRPC Server(50051)** 실행
  - **Native Health Check** 지원 (`grpc-health-checking`)
  - Redis Streams Consumer는 **제거됨** (Core가 직접 gRPC 호출)

- **의존성 관리**: `uv` 사용
  - `uv sync` 또는 `uv run`을 통해 의존성 자동 관리

---

## 3. 🔄 데이터 흐름 (Data Flow)

### 전체 프로세스 요약

```
1. STT → Redis Streams → Core (consume)
2. Core → LLM (gRPC streaming request)
3. LLM → Core (streaming response: THINKING + tokens)
4. Core → Redis Cache (append), Pub/Sub (실시간 자막), Queue (TTS용 문장)
5. TTS → Queue consume → Pub/Sub (음성)
6. Core → PostgreSQL (최종 저장), Redis (히스토리 갱신)
```

### 3.1 Input: Core → LLM (gRPC Streaming)

**gRPC API**: `LlmService.GenerateResponse`

**Request**:

```protobuf
message GenerateRequest {
  string interview_id = 1;
  string user_id = 2;
  string user_text = 3;        // STT에서 변환된 사용자 답변
  string persona = 4;           // AI 페르소나 (PRESSURE, COMFORTABLE, RANDOM)
  repeated ConversationHistory history = 5;  // 대화 히스토리
}
```

**Response (Streaming)**:

```protobuf
message TokenChunk {
  string token = 1;             // 생성된 토큰 (텍스트 조각)
  bool is_final = 2;            // 응답 완료 여부
  bool is_sentence_end = 3;     // 문장 끝 여부 (TTS 트리거용)
  string thinking = 4;          // LangGraph 노드 실행 정보 (선택적)
}
```

### 3.2 LLM 내부 처리 (LangGraph)

**현재 구현** (OpenAI API):

```python
# 단순 스트리밍
for chunk in completion:
    yield TokenChunk(token=chunk.choices[0].delta.content)
```

**향후 구현** (LangGraph):

```python
from langgraph.graph import StateGraph

# 노드 실행 시마다 THINKING 전송
for node_name, node_output in graph.stream():
    yield TokenChunk(thinking=f"[{node_name}] {node_output}")

# 최종 응답 스트리밍
for token in final_response:
    yield TokenChunk(token=token, is_sentence_end=is_end(token))
```

### 3.3 Output: LLM → Core (Streaming Response)

Core 서비스는 LLM의 스트리밍 응답을 받아 다음 작업을 **동시에** 수행합니다:

#### 1. **Redis Cache에 Append**

- **Key**: `interview:response:{interview_id}`
- **Purpose**: 안정성 확보 (네트워크 끊김 대비)
- **Action**: `APPEND` 명령으로 토큰 누적

#### 2. **Redis Pub/Sub 발행 (실시간 자막)**

- **Channel**: `interview:transcript:{interview_id}`
- **Payload**:
  ```json
  {
    "interviewId": 123,
    "token": "React Hooks는",
    "thinking": "[ANALYZE_ANSWER] 사용자 답변 분석 중...",
    "timestamp": "2024-01-01T12:00:00Z"
  }
  ```
- **Consumer**: Socket Service → WebSocket → Client

#### 3. **Redis Queue에 문장 단위 Push (TTS용)**

- **Queue**: `tts:sentence:queue`
- **Trigger**: `is_sentence_end = true`일 때
- **Payload**:
  ```json
  {
    "interviewId": 123,
    "sentence": "React Hooks는 어떤 상황에서 사용하셨나요?",
    "sentenceIndex": 0,
    "persona": "COMFORTABLE",
    "mode": "practice"
  }
  ```

#### 4. **최종 완료 시 (is_final = true)**

**PostgreSQL 저장**:

```sql
INSERT INTO interview_results (interview_id, user_answer, ai_answer, created_at)
VALUES (?, ?, ?, NOW());
```

**Redis 히스토리 갱신**:

- **Key**: `interview:history:{interview_id}`
- **Action**:
  ```python
  history.append({"role": "user", "content": user_text})
  history.append({"role": "assistant", "content": full_response})
  redis.setex(key, 3600, json.dumps(history))
  ```

---

## 4. 🎙️ TTS 프로세스 (Separate Flow)

### TTS Service 역할

**Input**: Redis Queue (`tts:sentence:queue`)

```json
{
  "interviewId": 123,
  "sentence": "React Hooks는 어떤 상황에서 사용하셨나요?",
  "sentenceIndex": 0,
  "persona": "COMFORTABLE",
  "mode": "practice"
}
```

**Processing**:

1. Queue에서 문장 consume (`BLPOP`)
2. TTS 생성 (OpenAI TTS / Edge-TTS)
3. 음성 데이터를 Redis Pub/Sub로 발행

**Output**: Redis Pub/Sub

- **Channel**: `interview:audio:{interview_id}`
- **Payload**:
  ```json
  {
    "interviewId": 123,
    "sentenceIndex": 0,
    "audioData": "<base64-encoded-audio>",
    "duration": 2.5
  }
  ```

**Consumer**: Socket Service → WebSocket → Client (오디오 재생)

---

## 5. ⚙️ 환경 설정 (Configuration)

| 환경변수       | 기본값        | 설명           |
| :------------- | :------------ | :------------- |
| `GRPC_PORT`    | `50051`       | gRPC 서버 포트 |
| `REDIS_HOST`   | `redis`       | Redis 호스트   |
| `REDIS_PORT`   | `6379`        | Redis 포트     |
| `REDIS_DB`     | `1`           | Redis DB 번호  |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI 모델    |

---

## 6. 🔌 통합 아키텍처 (Integration)

```
┌─────────────┐
│ STT Service │ ──► Redis Streams ──► ┌──────────────┐
└─────────────┘    (stt:transcript)    │ Core Service │
                                       │              │
                                       │ 1. Consume   │
                                       │ 2. gRPC Call │◄─┐
                                       └──────┬───────┘  │
                                              │ gRPC     │
                                              ▼          │ Stream
                                       ┌──────────────┐  │
                                       │ LLM Service  │  │
                                       │              │  │
                                       │ - gRPC Server│──┘
                                       │ - LangGraph  │
                                       │ - Streaming  │
                                       └──────────────┘

Core Service 처리:
┌──────────────────────────────────────────────────────┐
│ LLM Response Stream 수신                              │
│                                                       │
│ ┌─────────────┐  ┌─────────────┐  ┌──────────────┐ │
│ │ Redis Cache │  │ Pub/Sub     │  │ TTS Queue    │ │
│ │ (append)    │  │ (실시간자막)│  │ (문장단위)   │ │
│ └─────────────┘  └─────────────┘  └──────────────┘ │
│                                                       │
│ is_final = true 시:                                  │
│ ┌─────────────┐  ┌─────────────┐                    │
│ │ PostgreSQL  │  │ Redis       │                    │
│ │ (저장)      │  │ (히스토리)  │                    │
│ └─────────────┘  └─────────────┘                    │
└──────────────────────────────────────────────────────┘

TTS Service:
┌──────────────┐
│ TTS Service  │ ◄── Redis Queue (tts:sentence:queue)
│              │
│ - Consume    │
│ - Generate   │
│ - Publish    │ ──► Redis Pub/Sub (interview:audio)
└──────────────┘                │
                                ▼
                         ┌────────────────┐
                         │ Socket Service │ ──► WebSocket ──► Client
                         └────────────────┘
```

---

## 7. 🛠 주요 로직 (Core Logic)

### 7.1 LLM gRPC Handler (`service/grpc_handler.py`)

```python
def GenerateResponse(self, request, context):
    # 대화 맥락 구성
    history = self.context_manager.load_history(request.interview_id)
    messages = self.llm_service.build_messages(history, request.user_text)

    # 스트리밍 응답 생성
    for token in self.llm_service.generate_stream(messages):
        is_sentence_end = self.llm_service.is_sentence_end(accumulated)

        yield TokenChunk(
            token=token,
            is_sentence_end=is_sentence_end,
            thinking=current_thinking  # LangGraph 노드 정보
        )

    # 최종 완료
    yield TokenChunk(token="", is_final=True)
```

### 7.2 LangGraph 통합 (향후)

```python
from langgraph.graph import StateGraph, END

class InterviewGraph:
    def __init__(self):
        self.graph = StateGraph()
        self.graph.add_node("analyze_answer", self.analyze)
        self.graph.add_node("generate_question", self.generate)
        self.graph.add_edge("analyze_answer", "generate_question")
        self.graph.add_edge("generate_question", END)

    def stream_with_thinking(self, user_text):
        # 노드 실행 시마다 THINKING 전송
        for node_name, output in self.graph.stream({"input": user_text}):
            yield {"thinking": f"[{node_name}] {output}"}

        # 최종 응답 스트리밍
        for token in final_response:
            yield {"token": token}
```

---

## 8. 🚧 향후 확장 계획 (Future Enhancements)

### LangGraph 기반 면접 시나리오 엔진

- **노드 구성**:
  1. `analyze_answer`: 사용자 답변 분석
  2. `check_depth`: 답변 깊이 평가
  3. `select_strategy`: 질문 전략 선택 (꼬리질문 vs 새 주제)
  4. `generate_question`: 최종 질문 생성
  5. `evaluate_difficulty`: 난이도 조정

### THINKING 활용

- 클라이언트에서 "AI가 생각 중..." UI 표시
- 디버깅 및 모니터링 용이성 향상
- 면접 과정 투명성 제공

### 멀티 모델 지원

- GPT-4, Claude, Gemini 등 다양한 모델
- 모델별 프롬프트 최적화
- A/B 테스팅 지원
