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

---

### 3. `BotQuestion` (구 `interview.text.output`)

**목적**: Core → TTS Worker AI 응답 문장  
**Producer**: Core Service (Streaming Pipeline 버퍼링 후 발행)  
**Consumer**: tts (TTS Worker)

**스키마**:

```json
{
  "eventType": "BotQuestion",
  "interviewId": 123,
  "userId": "user-uuid",
  "sentence": "그렇군요. 어떤 프로젝트를 담당하셨나요?",
  "sentenceIndex": 1,
  "persona": "COMFORTABLE",
  "mode": "practice",
  "timestamp": "2026-01-11T10:30:47.789Z",
  "traceId": "trace-uuid"
}
```

**핵심 특징**:

- Core가 LLM의 토큰 스트림을 수신하다가 **문장 부호(. ? !) 감지 시 즉시 발행**
- TTS Worker가 문장 단위로 병렬 처리 → 사용자는 앞 문장 재생 중 뒷내용 생성

**Partitioning**: `interviewId`

---

### 4. `storage.completed`

**목적**: Storage Worker → Core Gap Filling 트리거  
**Producer**: storage (Storage Worker)  
**Consumer**: Core Service

**스키마**:

```json
{
  "eventType": "storage.completed",
  "interviewId": 123,
  "userId": "user-uuid",
  "objectUrl": "https://objectstorage.ap-seoul-1.oraclecloud.com/n/namespace/b/interview-archives/o/interviews/user123/interview123/20260111_103048.webm",
  "metadata": {
    "format": "webm",
    "sampleRate": 16000,
    "channels": 1,
    "uploadedAt": "2026-01-11T10:30:50.000Z"
  },
  "timestamp": "2026-01-11T10:30:50.123Z"
}
```

**처리 로직**:

1. Core가 이벤트 수신
2. DB에서 해당 interview의 전사 데이터 조회
3. 누락 구간(time gap) 감지
4. Object Storage에서 원본 다운로드
5. 배치 STT 실행 → DB 업데이트

**Partitioning**: `interviewId`

---

### 5. `interview.started`

**목적**: 면접 시작 알림  
**Producer**: BFF/Core Service  
**Consumer**: Monitoring, Analytics

**스키마**:

```json
{
  "eventType": "interview.started",
  "interviewId": 123,
  "userId": "user-uuid",
  "persona": "COMFORTABLE",
  "mode": "practice",
  "timestamp": "2026-01-11T10:30:00.000Z"
}
```

---

### 6. `interview.completed`

**목적**: 면접 완료 알림  
**Producer**: BFF/Core Service  
**Consumer**: Monitoring, Analytics, Report Generator

**스키마**:

```json
{
  "eventType": "interview.completed",
  "interviewId": 123,
  "userId": "user-uuid",
  "duration": 1800,
  "questionCount": 12,
  "status": "COMPLETED",
  "timestamp": "2026-01-11T11:00:00.000Z"
}
```

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
Redis Stream: stt:transcript:stream → Core Service
    ↓
Core: LLM gRPC 토큰 스트리밍
    ↓ (문장 부호 감지)
Kafka: BotQuestion (문장 단위) → TTS Worker
    ↓
TTS Worker: gRPC Stream → Socket Service
    ↓
Socket.IO: audio_chunk → Client (Browser)
```

---

## ⚙️ 토픽 설정 권장사항

### 로컬 개발 (Kind Cluster)

```yaml
interview.audio.input:
  partitions: 3
  replication-factor: 2
  retention.ms: 3600000 # 1시간 (실시간 처리 후 불필요)

BotQuestion:
  partitions: 3
  replication-factor: 2
  retention.ms: 86400000 # 24시간

storage.completed:
  partitions: 2
  replication-factor: 2
  retention.ms: 604800000 # 7일 (Gap Filling 재처리 대비)
```

### 프로덕션 (OKE)

```yaml
interview.audio.input:
  partitions: 6
  replication-factor: 2
  min.insync.replicas: 1
  retention.ms: 3600000

BotQuestion:
  partitions: 6
  replication-factor: 2
  min.insync.replicas: 1
  retention.ms: 604800000

storage.completed:
  partitions: 3
  replication-factor: 2
  min.insync.replicas: 1
  retention.ms: 2592000000 # 30일
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
  --create --topic BotQuestion --partitions 3 --replication-factor 2

kubectl exec -it kafka-0 -n infra -- /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 \
  --create --topic storage.completed --partitions 2 --replication-factor 2
```

---

## 📊 모니터링 포인트

- **interview.audio.input**: Consumer Lag < 100ms (실시간성 확보)
- **BotQuestion**: 문장 단위 발행 간격 (버퍼링 효과 확인)
- **storage.completed**: Gap Filling 트리거 빈도 (실시간 STT 안정성 지표)

---

참고:

- 기존 토픽 `interview.text.input`, `interview.text.output`는 `UserAnswer`, `BotQuestion`로 명명 규칙 통일
- `tts.requested` 토픽은 deprecated (Streaming Pipeline 방식으로 대체)
