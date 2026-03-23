# 🎯 STT Service Architecture

STT(Speech-to-Text) 서비스는 gRPC를 통해 오디오 스트림을 수신하고, 이를 텍스트로 변환하여 Redis Pub/Sub 및 Stream으로 발행하는 역할을 담당합니다.

---

## 1. 📂 파일 구조 (File Structure)

```
stt/
  main.py                # gRPC 서버 엔트리포인트 (Native Health Check 포함)
  pyproject.toml         # 의존성 관리 (uv 기반)
  config.py              # 환경설정 중앙 관리

  api/
    grpc_server.py       # (Deprecated) gRPC 서버 모듈

  service/
    stt_service.py       # gRPC Servicer 구현 및 서버 로직 (Health Check 등록)
    worker/
      audio_request_worker.py  # 핵심 비즈니스 로직 (VAD -> Engine -> Publish)
      vad_utils.py       # VAD 유틸리티
      metadata_utils.py  # 메타데이터 추출
      postprocess.py     # 텍스트 후처리

  engine/                # STT 엔진 래퍼 (Whisper, OpenAI)
  event/                 # Redis Publisher 유틸리티
  proto/                 # gRPC Proto 파일 (services/proto와 동기화 필요)
  utils/                 # 로깅 등 유틸리티
```

---

## 2. 🚀 실행 방식 (Execution)

기존 Multiprocessing 및 Supervisor 방식에서 **단일 Python 스크립트(`main.py`)** 기반으로 변경되었습니다.

- **실행**: `uv run main.py`
  - 단일 프로세스로 **gRPC Server(50052)**를 실행합니다.
  - **Native Health Check**를 지원하여 별도의 HTTP 헬스 체크 서버가 필요 없습니다.
  - `grpc-health-checking` 라이브러리를 통해 Liveness/Readiness Probe를 처리합니다.

- **의존성 관리**: `uv` 사용
  - `uv sync` 또는 `uv run`을 통해 의존성을 자동 관리합니다.

---

## 3. 🔄 데이터 흐름 (Data Flow)

### 3.1 Input (From Socket Service)

- **Protocol**: gRPC Streaming (`SttService.SpeechToText`)
- **Format**: `AudioChunk` (PCM Audio + Metadata)
- **Metadata**: `interviewSessionId`, `userId`, `traceId` 등

### 3.2 Output (To Socket Service)

전처리 및 STT 변환 후, 결과(Transcript)를 Redis 채널로 발행합니다.

1. **Redis Pub/Sub**
   - **Channel**: `stt:transcript:pubsub`
   - **Purpose**: 실시간 클라이언트 전송 (ProcessAudioService가 구독)

2. **Redis Streams**
   - **Stream Key**: `stt:transcript:stream`
   - **Purpose**: 신뢰성 있는 메시지 처리 및 로그 저장

**Payload 구조**:

```json
{
  "interviewSessionId": 123,
  "text": "안녕하세요 면접자입니다.",
  "isFinal": true,
  "timestamp": "2024-01-01T12:00:00Z",
  "engine": "faster-whisper",
  "isEmpty": false,
  "traceId": "abc-123",
  "userId": "user-uuid"
}
```

---

## 4. ⚙️ 환경 설정 (Configuration)

`config.py`에서 관리하며, 주요 환경변수는 다음과 같습니다.

| 환경변수            | 기본값                  | 설명                 |
| :------------------ | :---------------------- | :------------------- |
| `STT_REDIS_CHANNEL` | `stt:transcript:pubsub` | Redis Pub/Sub 채널   |
| `STT_REDIS_STREAM`  | `stt:transcript:stream` | Redis Stream 키      |
| `STT_GRPC_PORT`     | `50052`                 | gRPC 서버 포트       |
| `SAMPLE_RATE`       | `16000`                 | 오디오 샘플링 레이트 |

---

## 5. 🛠 주요 로직 (Core Logic)

`service/worker/audio_request_worker.py`가 핵심입니다.

1. **청크 수집**: gRPC Iterator를 순회하며 오디오 데이터를 `audio_chunks` 리스트에 누적.
2. **VAD (Voice Activity Detection)**:
   - `vad_utils.py`를 통해 음성/침묵 구간 판단.
   - 일정 시간 이상 침묵 시 자동 Finalize(종료) 처리.
3. **Engine 실행**:
   - `practice` 모드: 로컬 Faster-Whisper 실행.
   - `real` 모드: OpenAI API 호출 (실패 시 로컬로 Fallback).
4. **Publish**:
   - 변환된 텍스트를 구성하여 Redis로 전송.
