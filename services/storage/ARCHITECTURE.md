# 🎯 Storage Service Architecture

Storage 서비스는 Redis Queue에서 오디오 청크를 수신하고, 이를 조립하여 Object Storage(OCI/MinIO)에 업로드한 후 Kafka로 완료 이벤트를 발행하는 역할을 담당합니다.

---

## 1. 📂 파일 구조 (File Structure)

```
storage/
  main.py                # 서비스 엔트리포인트 (FastAPI + Worker Thread)
  config.py              # 환경설정 중앙 관리
  pyproject.toml         # 의존성 관리 (uv 기반)

  service/
    storage_service.py   # 메인 서비스 오케스트레이터
    worker/
      queue_processor.py # Redis 큐 처리 로직
      metadata_utils.py  # 메타데이터 추출 유틸리티

  engine/
    object_storage.py    # S3/OCI Object Storage 클라이언트 래퍼

  event/
    producer.py          # Kafka Producer 래퍼
    consumer.py          # Redis Consumer 유틸리티

  utils/
    log_format.py        # JSON 로깅 유틸리티
```

---

## 2. 🚀 실행 방식 (Execution)

기존 Supervisor 기반 멀티프로세스 방식에서 **단일 Python 스크립트(`main.py`)** 기반으로 변경되었습니다.

- **실행**: `uv run main.py`
  - FastAPI 서버(8000)를 실행하여 헬스 체크 제공
  - 백그라운드 스레드에서 Storage Worker 실행
  - Kubernetes Liveness/Readiness Probe 지원

- **의존성 관리**: `uv` 사용
  - `uv sync` 또는 `uv run`을 통해 의존성을 자동 관리합니다.

---

## 3. 🔄 데이터 흐름 (Data Flow)

### 3.1 Input (From Socket Service)

- **Protocol**: Redis Queue (BLPOP)
- **Queue Pattern**: `interview:audio:{interview_id}`
- **Format**: JSON messages with base64-encoded audio chunks

**Message Structure**:

```json
{
  "audioData": "base64_encoded_audio_chunk",
  "metadata": {
    "sample_rate": 16000,
    "channels": 1,
    "format": "webm"
  },
  "isFinal": false
}
```

### 3.2 Processing Flow

1. **Queue Scanning**: 주기적으로 Redis를 스캔하여 `interview:audio:*` 패턴의 큐 탐색
2. **Chunk Assembly**: BLPOP으로 청크를 순차 수신하고 조립
3. **Object Upload**: 조립된 오디오를 OCI/MinIO Object Storage에 업로드
4. **Event Publishing**: Kafka로 `storage.completed` 이벤트 발행
5. **Queue Cleanup**: 성공적으로 처리된 큐 삭제

### 3.3 Output (To Core Service)

**Kafka Event** (`storage.completed` topic):

```json
{
  "eventType": "storage.completed",
  "interviewId": 123,
  "userId": 456,
  "objectUrl": "https://objectstorage.../interviews/456/123/20240101_120000.webm",
  "metadata": {
    "sample_rate": 16000,
    "channels": 1,
    "format": "webm"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

---

## 4. ⚙️ 환경 설정 (Configuration)

`config.py`에서 관리하며, 주요 환경변수는 다음과 같습니다.

| 환경변수                   | 기본값               | 설명                      |
| :------------------------- | :------------------- | :------------------------ |
| `PORT`                     | `8000`               | 헬스 체크 서버 포트       |
| `REDIS_HOST`               | `redis`              | Redis 호스트              |
| `REDIS_PORT`               | `6379`               | Redis 포트                |
| `REDIS_DB`                 | `0`                  | Redis 데이터베이스 번호   |
| `REDIS_AUDIO_QUEUE_PREFIX` | `interview:audio`    | 오디오 큐 프리픽스        |
| `OBJECT_STORAGE_ENDPOINT`  | -                    | Object Storage 엔드포인트 |
| `OBJECT_STORAGE_BUCKET`    | `interview-archives` | 버킷 이름                 |
| `KAFKA_BROKER`             | `kafka:29092`        | Kafka 브로커 주소         |
| `STORAGE_COMPLETED_TOPIC`  | `storage.completed`  | 완료 이벤트 토픽          |
| `QUEUE_SCAN_INTERVAL_SEC`  | `10`                 | 큐 스캔 주기 (초)         |
| `QUEUE_TIMEOUT_SEC`        | `30`                 | BLPOP 타임아웃 (초)       |

---

## 5. 🛠 주요 로직 (Core Logic)

### 5.1 Queue Processor (`service/worker/queue_processor.py`)

핵심 비즈니스 로직:

1. **청크 수집**: BLPOP으로 Redis 큐에서 메시지를 순차 수신
2. **메타데이터 추출**: 각 메시지에서 메타데이터 추출 및 병합
3. **청크 조립**: base64 디코딩 후 바이너리 청크를 리스트에 누적
4. **종료 감지**: `isFinal: true` 플래그 또는 타임아웃으로 종료 판단
5. **업로드**: Object Storage Engine을 통해 S3/OCI에 업로드
6. **이벤트 발행**: Kafka Producer를 통해 완료 이벤트 발행

### 5.2 Storage Service (`service/storage_service.py`)

서비스 오케스트레이터:

1. **초기화**: Redis, Object Storage, Kafka 클라이언트 초기화
2. **큐 스캔**: 주기적으로 Redis를 스캔하여 처리할 큐 탐색
3. **큐 처리**: Queue Processor를 호출하여 각 큐 처리
4. **에러 핸들링**: 실패 시 로깅 및 재시도 로직
5. **정리**: 성공적으로 처리된 큐 삭제

---

## 6. 🏗️ Architecture Alignment

이 서비스는 STT 서비스와 동일한 Clean Architecture 패턴을 따릅니다:

- **Service Layer**: 비즈니스 로직 조율 (`storage_service.py`, `queue_processor.py`)
- **Engine Layer**: 외부 시스템 래퍼 (`object_storage.py`)
- **Event Layer**: 메시징 인프라 (`producer.py`, `consumer.py`)
- **Utils Layer**: 공통 유틸리티 (`log_format.py`)
- **Config**: 중앙 집중식 설정 관리 (`config.py`)

---

## 7. 🧪 Health Checks

- **Liveness**: `GET /health` → `{"status": "ok"}`
- **Readiness**: `GET /health/ready` → `{"status": "ready"}` (worker 실행 중일 때만)

---

## 8. 🐳 Docker Deployment

```bash
# Build
docker build -t storage-service:latest .

# Run
docker run -p 8000:8000 \
  -e REDIS_HOST=redis \
  -e OBJECT_STORAGE_ENDPOINT=https://... \
  -e KAFKA_BROKER=kafka:29092 \
  storage-service:latest
```
