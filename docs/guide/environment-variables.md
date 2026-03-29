# 환경 변수 설정 가이드

이 문서는 각 서비스별 환경 변수와 설정값을 정의합니다.

---

## 🔧 BFF (API Gateway)

### 필수

- `CORE_GRPC_HOST`: Core gRPC 서버 호스트 (기본: `core`)
- `CORE_GRPC_PORT`: Core gRPC 서버 포트 (기본: `9090`)
- `JWT_SECRET`: JWT 토큰 서명 키 (필수, 시크릿)
- `KAFKA_BROKER`: Kafka 브로커 주소 (기본: `kafka:29092`)
- `REDIS_HOST`: Redis 호스트 (기본: `redis`)
- `REDIS_PORT`: Redis 포트 (기본: `6379`)

### 선택

- `LLM_GRPC_URL`: LLM gRPC 전체 URL (기본: `llm:50051`)
- `PORT`: 서버 포트 (기본: `3000`)
- `NODE_ENV`: 실행 환경 (기본: `development`)

---

## 🧠 Core (Domain Service)

### 아키텍처 설정

- `CORE_GRPC_PORT`: gRPC 서버 포트 (기본: `9090`)
- `LLM_GRPC_URL`: LLM gRPC 서버 URL (기본: `llm:50051`)
- `KAFKA_BROKER`: Kafka 브로커 (기본: `kafka:29092`)

### 데이터베이스 (CQRS)

**Command Store (ATP - Oracle)**:

- `DB_COMMAND_URL`: ATP JDBC URL
- `DB_COMMAND_USERNAME`: 사용자명
- `DB_COMMAND_PASSWORD`: 비밀번호 (시크릿)

**Query Store (AJD - MongoDB 호환)**:

- `DB_QUERY_URL`: AJD 연결 URL
- `DB_QUERY_USERNAME`: 사용자명
- `DB_QUERY_PASSWORD`: 비밀번호 (시크릿)

### Redis

- `REDIS_HOST`: Redis 호스트 (기본: `redis`)
- `REDIS_PORT`: Redis 포트 (기본: `6379`)
- `REDIS_DB`: Redis 데이터베이스 번호 (기본: `0`)

---

## 🔌 Socket (Real-time Gateway)

### 핵심 설정

- `STT_GRPC_URL`: STT Worker gRPC 주소 (향후 Fast Path 직접 스트리밍용)
- `KAFKA_BROKER`: Kafka 브로커 (기본: `kafka:29092`)
- `REDIS_HOST`: Redis 호스트 (기본: `redis`)
- `REDIS_PORT`: Redis 포트 (기본: `6379`)

### 기타 설정

- `LLM_GRPC_URL`: LLM gRPC 서버 (기본: `llm:50051`)
- `PYTHON_WORKER_URL`: LLM HTTP API (기본: `http://llm:8000`)
- `PORT`: 서버 포트 (기본: `3001`)

---

## 🤖 LLM (Orchestration Service)

### 인프라 설정

- `OPENAI_API_KEY`: OpenAI API 키 (TTS/STT용, 시크릿)
- `GRPC_PORT`: gRPC 서버 포트 (기본: `50051`)
- `KAFKA_BROKER`: Kafka 브로커 (기본: `kafka:29092`)
- `REDIS_HOST`: Redis 호스트 (기본: `redis`)
- `REDIS_PORT`: Redis 포트 (기본: `6379`)

### 운영 설정

- `PORT`: HTTP API 포트 (기본: `8000`)
- `LANGCHAIN_API_KEY`: LangChain 추적용 (선택)
- `EDGE_TTS_ENABLED`: Edge-TTS 사용 여부 (기본: `true`, practice 모드)

---

## 🛠️ stt

### 공통

- `KAFKA_BROKER`: Kafka 브로커 (기본: `kafka:29092`)
- `REDIS_HOST`: Redis 호스트 (기본: `redis`)
- `REDIS_PORT`: Redis 포트 (기본: `6379`)
- `PORT`: HTTP 헬스 체크 포트 (기본: `8000`)

### STT Worker

- `STT_INPUT_TOPIC`: 오디오 입력 토픽 (기본: `interview.audio.input`)
- `WHISPER_MODEL_SIZE`: Faster-Whisper 모델 크기 (기본: `tiny`, 옵션: `base`, `small`, `medium`)
- `WHISPER_DEVICE`: 디바이스 (기본: `cpu`)
- `WHISPER_COMPUTE_TYPE`: 연산 타입 (기본: `int8`)
- `REDIS_DB`: Redis DB 번호 (기본: `0`)

### STT gRPC Server

- `STT_GRPC_PORT`: gRPC 포트 (기본: `50052`)
- `OPENAI_API_KEY`: OpenAI Realtime/Whisper API 키 (real 모드용, 시크릿)

---

## 🛠️ tts

- `KAFKA_BROKER`: Kafka 브로커 (기본: `kafka:29092`)
- `REDIS_HOST`: Redis 호스트 (기본: `redis`)
- `REDIS_PORT`: Redis 포트 (기본: `6379`)
- `REDIS_DB`: Redis DB 번호 (기본: `0`)
- `OPENAI_API_KEY`: OpenAI TTS API 키 (real 모드용, 시크릿)
- `EDGE_TTS_ENABLED`: Edge-TTS 사용 여부 (기본: `true`)
- `PORT`: HTTP 헬스 체크 포트 (기본: `8000`)

---

## 🛠️ storage

- `KAFKA_BROKER`: Kafka 브로커 (기본: `kafka:29092`)
- `STORAGE_COMPLETED_TOPIC`: 완료 이벤트 토픽 (기본: `storage.completed`)
- `REDIS_HOST`: Redis 호스트 (기본: `redis`)
- `REDIS_PORT`: Redis 포트 (기본: `6379`)
- `REDIS_DB`: Redis DB 번호 (기본: `0`)
- `REDIS_AUDIO_QUEUE_PREFIX`: Redis 큐 접두사 (기본: `interview:audio`)
- `PORT`: HTTP 헬스 체크 포트 (기본: `8000`)

**Object Storage (OCI/S3 호환)**:

- `OBJECT_STORAGE_ENDPOINT`: Object Storage 엔드포인트 (예: `https://objectstorage.ap-seoul-1.oraclecloud.com`)
- `OBJECT_STORAGE_ACCESS_KEY`: 액세스 키 (시크릿)
- `OBJECT_STORAGE_SECRET_KEY`: 시크릿 키 (시크릿)
- `OBJECT_STORAGE_BUCKET`: 버킷 이름 (기본: `interview-archives`)
- `OBJECT_STORAGE_REGION`: 리전 (기본: `ap-seoul-1`)

---

## 🔐 시크릿 관리

### Kubernetes Secret 생성 (로컬/프로덕션)

```bash
# stt secrets
kubectl create secret generic stt-secrets \
  --from-literal=OPENAI_API_KEY=sk-xxx \
  -n unbrdn

# tts secrets
kubectl create secret generic tts-secrets \
  --from-literal=OPENAI_API_KEY=sk-xxx \
  -n unbrdn

# storage secrets
kubectl create secret generic storage-secrets \
  --from-literal=OBJECT_STORAGE_ACCESS_KEY=xxx \
  --from-literal=OBJECT_STORAGE_SECRET_KEY=xxx \
  -n unbrdn

# Core database secrets
kubectl create secret generic oracle-db-credentials \
  --from-literal=DB_COMMAND_PASSWORD=xxx \
  --from-literal=DB_QUERY_PASSWORD=xxx \
  -n unbrdn

# BFF JWT secret
kubectl create secret generic bff-secrets \
  --from-literal=JWT_SECRET=your-secret-key \
  -n unbrdn
```

---

## 🌐 토픽 설정 (Kafka)

### 사용 토픽 목록

- `interview.audio.input`: Fast Path 오디오 스트리밍
- `storage.completed`: 아카이빙 완료 알림
- `interview.started`: 면접 시작 이벤트
- `interview.completed`: 면접 완료 이벤트

상세 스키마는 `docs/kafka-topics.md` 참조

---

## 📊 Redis 데이터베이스 통합
- **DB 0**: 모든 서비스 공통 (실시간 파이프라인, 상태 관리, 큐 등 합산 관리)
  - 3-Track 아키텍처에 따라 호스트로 구분하고 DB 번호는 0으로 통일함.

---

## 🔄 환경별 설정 예시

### 로컬 개발 (Kind)

```yaml
KAFKA_BROKER: "kafka:29092"
REDIS_HOST: "redis"
CORE_GRPC_URL: "core:9090"
LLM_GRPC_URL: "llm:50051"
WHISPER_MODEL_SIZE: "tiny"
EDGE_TTS_ENABLED: "true"
OBJECT_STORAGE_ENDPOINT: "" # 로컬 테스트 시 비활성화 가능
```

### 프로덕션 (OKE)

```yaml
KAFKA_BROKER: "kafka.infra.svc.cluster.local:29092"
REDIS_HOST: "redis-master.infra.svc.cluster.local"
CORE_GRPC_URL: "core.unbrdn.svc.cluster.local:9090"
LLM_GRPC_URL: "llm.unbrdn.svc.cluster.local:50051"
WHISPER_MODEL_SIZE: "small" # 정확도 향상
EDGE_TTS_ENABLED: "true"
OBJECT_STORAGE_ENDPOINT: "https://objectstorage.ap-seoul-1.oraclecloud.com"
OBJECT_STORAGE_BUCKET: "interview-prod-archives"
```

---

## ⚠️ 주의사항

1. **시크릿 키는 절대 코드에 하드코딩하지 않습니다**
2. **로컬 개발 시 `.env` 파일은 `.gitignore`에 포함**
3. **프로덕션 시크릿은 Kubernetes Secret 또는 Vault 사용**
4. **OPENAI_API_KEY는 비용 발생 — 사용량 모니터링 필수**
5. **Object Storage 크레덴셜은 최소 권한 원칙 적용 (Put/Get만)**

---

참고:

- 아키텍처: [docs/architecture/architecture.md](../architecture/architecture.md)
- 운영·배포: [docs/ops/ops_consolidated.md](../ops/ops_consolidated.md)
