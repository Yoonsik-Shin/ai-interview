# 🎙️ TTS Service Architecture

TTS(Text-to-Speech) 서비스는 Redis Queue에서 문장 단위 요청을 소비하고, 음성을 생성해 Redis Pub/Sub으로 발행하는 역할을 담당합니다. 전체 플로우는 `docs/architecture-diagrams.md` 및 `.agent/rules/architecture.png`의 실시간 파이프라인과 일치합니다.

---

## 1. 📂 파일 구조 (File Structure)

```
tts/
  main.py                # 엔트리포인트 (Redis Consumer + gRPC Health)
  pyproject.toml         # 의존성 관리 (uv 기반)
  uv.lock                # 의존성 잠금 파일
  config.py              # 환경설정 중앙 관리

  engine/                # TTS 엔진 래퍼 (OpenAI, Edge-TTS)
  event/                 # Redis 연결 유틸리티
  service/
    tts_service.py       # Redis Queue 소비 루프
    worker/
      tts_request_worker.py  # TTS 생성 + Pub/Sub 발행 로직
  utils/                 # 로깅 등 유틸리티
```

---

## 2. 🚀 실행 방식 (Execution)

- **실행**: `uv run main.py`
  - 단일 프로세스로 Redis Queue 소비 + gRPC Health 서버를 동시에 실행합니다.
  - **Native Health Check**: `grpc-health-checking` 사용, Kubernetes gRPC Probe 지원.
- **의존성 관리**: `uv` 사용
  - `uv sync` 또는 `uv run`으로 의존성을 관리합니다.

---

## 3. 🔄 데이터 흐름 (Data Flow)

### 3.1 Input (From Core Service)

- **Protocol**: Redis Queue (List) `BLPOP`
- **Key**: `tts:sentence:queue`
- **Payload**: `BotQuestion` 이벤트 기반 JSON

### 3.2 Output (To Socket Service)

음성을 생성한 뒤 Redis Pub/Sub으로 발행합니다.

- **Channel**: `interview:audio:{interviewId}`
- **Purpose**: Socket 서비스가 구독 → 클라이언트로 오디오 전송

**Payload 구조**:

```json
{
  "interviewId": 123,
  "sentenceIndex": 0,
  "audioData": "<base64>",
  "timestamp": "2024-01-01T12:00:00Z",
  "persona": "COMFORTABLE",
  "mode": "practice",
  "traceId": "abc-123",
  "userId": "user-uuid"
}
```

---

## 4. ⚙️ 환경 설정 (Configuration)

`config.py`에서 관리하며, 주요 환경변수는 다음과 같습니다.

| 환경변수                     | 기본값                           | 설명                          |
| :--------------------------- | :------------------------------- | :---------------------------- |
| `TTS_GRPC_PORT`              | `50053`                          | gRPC Health 서버 포트         |
| `TTS_INPUT_QUEUE`            | `tts:sentence:queue`             | Redis 입력 큐                 |
| `TTS_PUBSUB_CHANNEL_TEMPLATE`| `interview:audio:{interviewId}`  | Pub/Sub 채널 템플릿           |
| `EDGE_TTS_ENABLED`           | `true`                           | Edge-TTS 사용 여부            |
| `OPENAI_TTS_MODEL`           | `tts-1`                          | OpenAI TTS 모델               |
| `OPENAI_TTS_SPEED`           | `1.0`                            | OpenAI 재생 속도              |

---

## 5. 🛠 주요 로직 (Core Logic)

`service/worker/tts_request_worker.py`가 핵심입니다.

1. **큐 소비**: `tts_service.py`가 `BLPOP`으로 문장 이벤트 수신
2. **엔진 선택**:
   - `mode=real` → OpenAI TTS 시도, 실패 시 Edge-TTS 폴백
   - `mode=practice` → Edge-TTS 사용
3. **발행**: Base64 오디오로 `interview:audio:{interviewId}` 발행
4. **헬스 체크**: gRPC Health 서버에서 `SERVING` 상태 제공

---

## 6. 📌 참고 다이어그램

- `docs/architecture-diagrams.md` — 전체 데이터 플로우 및 시퀀스 다이어그램
- `.agent/rules/architecture.png` — Redis 기반 실시간 파이프라인 요약
