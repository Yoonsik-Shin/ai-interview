# Kafka 토픽 구조 및 이벤트 스키마

이 문서는 실시간 면접 시스템의 Kafka 토픽 구조와 각 이벤트의 스키마를 정의합니다.

## 📋 토픽 목록

### 1. `interview.audio.input` (Fast Path)

**목적**: Socket → STT Worker 실시간 오디오 스트리밍  
**Producer**: Socket Service
**Consumer**: stt (STT Worker)

**스키마**:

```json
{
  "interviewId": 123,
  "userId": "user-uuid",
  "audioChunk": "base64-encoded-audio-data",
  "isFinal": false,
  "audioFormat": "pcm16",
  "sampleRate": 16000,
  "inputGain": 1.0,
  "threshold": 0,
  "timestamp": "2026-01-11T10:30:45.123Z",
  "traceId": "trace-uuid"
}
```

**Partitioning**: `interviewId:userId`로 키를 구성하여 같은 면접의 청크는 순서 보장

---

### 2. `storage.completed`

**목적**: Storage Worker → Core Gap Filling 트리거  
**Producer**: storage (Storage Worker)  
**Consumer**: Core Service

**스키마**:

```json
{
  "eventType": "storage.completed",
  "interviewId": 123,
  "userId": "user-uuid",
  "objectUrl": "https://objectstorage.ap-seoul-1.oraclecloud.com/...",
  "metadata": {
    "format": "webm",
    "sampleRate": 16000,
    "channels": 1,
    "uploadedAt": "2026-01-11T10:30:50.000Z"
  },
  "timestamp": "2026-01-11T10:30:50.123Z"
}
```

**Partitioning**: `interviewId`

---

### 3. `interview.result`

**목적**: Interview Core → 외부 시스템 면접 종료 데이터 전달
**Producer**: Core Service

---

## 🔄 이벤트 흐름 (End-to-End)

```
[User Speaks]
    ↓
Socket Service
    ├─ [Fast Path] → Kafka: interview.audio.input → STT Worker
    └─ [Safe Path] → Redis Queue → Storage Worker
                                         ↓
                                 Object Storage
                                         ↓
                                 Kafka: storage.completed → Core (Gap Filling)

STT Worker
    ↓
Redis Stream: interview:transcript:process → Core Service
    ↓
Core: LLM gRPC 토큰 스트리밍
    ↓ (문장 부호 감지)
Redis Stream: interview:sentence:generate → TTS Worker
    ↓
TTS Worker: Redis Pub/Sub → interview:audio:pubsub:{id}
    ↓
Socket.IO: audio_chunk → Client (Browser)
```

---

## ⚙️ 토픽 설정 권장사항

### 프로덕션 (OKE)

```yaml
interview.audio.input:
  partitions: 6
  replication-factor: 2
  retention.ms: 3600000

storage.completed:
  partitions: 3
  replication-factor: 2
  retention.ms: 2592000000
```

---

## 🛠️ 토픽 생성 스크립트

```bash
# Kind 로컬 환경
kubectl exec -it kafka-0 -n infra -- /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 \
  --create --topic interview.audio.input --partitions 3 --replication-factor 2

kubectl exec -it kafka-0 -n infra -- /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 \
  --create --topic storage.completed --partitions 2 --replication-factor 2
```
