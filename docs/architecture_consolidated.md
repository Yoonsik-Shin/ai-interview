# 통합 아키텍처 요약 (Consolidated)

생성일: 2026-01-10

목적: `docs/` 폴더에 분산돼 중복·중복성·구버전 정보가 섞여있는 아키텍처·운영 정보를 한 곳에 모아 빠르게 참고할 수 있도록 정리합니다. 상세 내용은 원본 문서로 이동하여 확인하세요.

---

## 1. 개요

- 패턴: 이벤트 기반 마이크로서비스 (Kafka 중심), gRPC 및 Socket.io를 통한 실시간 통신
- 핵심 서비스: `bff`(API), `core`(도메인), `socket`(실시간), `llm`(FastAPI/LangChain/RAG 오케스트레이션), `inference`(Triton GPU 모델 서빙, 향후 테스트용)
- 목표: 실시간성, 느슨한 결합, 비용 효율성(OCI/AWS 혼합), 테스트 가능한 로컬 HA 구성

## 2. 핵심 변경요점 요약

- 오케스트레이션 런타임은 `llm` 명칭(services/llm)으로 FastAPI/LangChain/RAG를 운영하고, 이미지/레지스트리 변수는 서비스별 `REPO_*`를 사용
- `inference`는 Triton 기반 GPU 모델 서빙 전용(향후 테스트용)으로 분리; 기본 빌드/배포 대상에는 포함하지 않음
- CI/스크립트/문서는 `llm` 중심으로 정리되며, 레지스트리 변수는 `REPO_LLM`, `REPO_STT`, `REPO_TTS`, `REPO_STORAGE`를 포함해 서비스별로 관리
- 생성/수정 경로: 서비스(`services/llm/*`), 매니페스트(`k8s/apps/llm/{common,local,prod}/*`), 워크플로/스크립트 업데이트
- 남은 권장 작업: 전수 검색으로 잔여 `inference` 문맥 분류(모델서빙 vs llm), 이미지 빌드/배포 검증, `llm-secrets` 구성

## 3. 서비스 맵 (요약)

- **BFF** (Node.js, NestJS): REST, JWT, 프론트엔드 프록시
- **Core** (Java, Spring Boot): 도메인 로직, gRPC 서버, DB(Oracle/ATP), 토큰 스트리밍 버퍼링
- **Socket** (Node.js): Socket.io, Kafka producer/consumer, gRPC client to LLM, Dual-Write 구현
- **LLM** (Python): FastAPI + gRPC, LangChain/RAG 오케스트레이션, 토큰 스트리밍 생성
- **stt** (Python): STT gRPC 서버 (오디오 처리 및 결과 발행)
- **tts** (Python): TTS Kafka Consumer (FastAPI 헬스 체크)
- **storage** (Python): gRPC Server + Storage Worker (Redis→Object Storage)
- **Triton** (Optional): GPU 기반 모델 서빙 (대형 모델, GPU 전용 노드, 향후 테스트용)

## 4. 인터페이스 / 포트 맵

- REST: BFF `:3000` → 클라이언트 HTTP
- gRPC: Core `:9090`, LLM `:50051` (Socket → LLM), 내부 통신 시 `OnModuleInit` 후 `getService()` 패턴 준수
- Kafka: 기본 `:29092` (로컬 Strimzi), 주요 토픽은 아래 이벤트 흐름 참조
- Redis: `:6379` (Sentinel 별도 포트), 세션/캐시용
- Socket.IO: Socket 서비스 `:3001` (예시, 실제 포트 매니페스트 확인) → 프론트

## 5. 이벤트 / 스트림 흐름

### Kafka 토픽 구조

- `interview.started` / `interview.completed`: 인터뷰 수명주기 이벤트
- `BotQuestion`: Core → TTS Worker (AI 응답 문장, 버퍼링 후 발행)
- `storage.completed`: Storage Worker → Core (파일 업로드 완료, Gap Filling 트리거)

### gRPC 스트리밍

- **Socket → STT Worker:** `StreamAudio()` - 실시간 오디오 스트림 전송 (Fast Path)
- **Core → LLM:** `GenerateResponse()` - 토큰 단위 스트리밍 응답 수신
- **TTS Worker → Socket:** `StreamTTS()` - 오디오 청크 스트리밍 전송

### 클라이언트 이벤트 (Socket.IO)

- `audio_chunk` (Server → Client): 실시간 오디오 재생용 청크 전달
- `audio_ack` (Server → Client): Redis 저장 완료 신호 (클라이언트 백업 삭제 트리거)

## 6. 인터뷰 실시간 플로우 (E2E) 및 핵심 전략

### 6.1. 입력 전략: Hybrid Dual-Write (속도와 안전의 이중주)

오디오 데이터 유실을 막고 실시간 반응성을 확보하기 위해 경로를 분리했습니다.

**⚡ Fast Path (속도):** Socket(Node.js) → gRPC Stream → STT Worker (stt)

- 중간에 Kafka를 거치지 않고 메모리 상에서 직접 흘려보내 지연 시간 최소화
- 실시간 STT 결과를 Redis Pub/Sub(`stt:transcript:pubsub`) 및 Redis Streams(`stt:transcript:stream`)에 즉시 발행

**🛡️ Safe Path (안전):** Socket → Redis → Storage Worker (storage gRPC/Worker) → Object Storage

- 면접 원본 영상을 비동기로 안전하게 저장
- Storage Worker는 storage로 분리하여 장애 격리
- Redis RPUSH로 오디오 청크를 큐잉하고 BLPOP으로 순차 업로드

**🔄 최후의 보루 (Client Retry):**

- Socket 서버가 다운되는 최악의 상황(Redis 저장 전 Crash)을 대비
- 클라이언트(브라우저)가 서버의 ACK(저장 완료 신호)를 받을 때까지 데이터를 버리지 않고 재전송
- MediaRecorder API를 활용한 청크 단위 백업 및 재시도 로직 구현

### 6.2. 처리 전략: Streaming Pipeline (토큰 스트리밍)

CPU 기반 LLM의 느린 추론 속도를 사용자에게 감추기 위한 전략입니다.

**Core (Spring Boot)의 역할:**

- STT가 Redis Streams를 통해 발행한 텍스트 이벤트를 수신
- LLM에 gRPC로 요청하되, 토큰(글자) 단위 스트림으로 응답을 받음

**지능형 버퍼링:**

- Core 내부에서 토큰을 모으다가 **문장 부호(. ? !)**가 나오면 즉시 잘라서 Kafka(`BotQuestion`)로 발행
- 결과: LLM이 뒷내용을 생각하는 동안, 사용자는 이미 앞 문장의 음성(TTS)을 듣게 됨
- **체감 대기 시간 < 1초** 달성

**TTS Worker (tts) 처리:**

- Kafka(`BotQuestion`)에서 문장 단위 이벤트 수신
- Edge-TTS 또는 OpenAI TTS로 오디오 변환
- gRPC Stream으로 Socket에 전달 → Socket.IO로 클라이언트에 실시간 재생

### 6.3. 복구 전략: Async Backfill (Gap Filling)

실시간 STT가 잠깐 끊겨도 최종 데이터는 완벽해야 합니다.

**Gap Filling:**

- Storage Worker가 파일 업로드를 마치면 완료 이벤트를 Kafka에 발행
- Core가 이를 감지하여, 만약 실시간 STT 누락으로 DB에 비어있는 구간이 있다면:
  - Object Storage에서 원본 오디오 파일을 다운로드
  - 배치 STT 처리로 누락된 텍스트를 채워 넣음
  - DB 업데이트 및 최종 완결성 확보

### 6.4. 최종 데이터 흐름 (상세 시퀀스)

1. **[User Input]** 사용자가 말함 → Socket Service 수신 (클라이언트는 ACK 대기)
2. **[Dual Write]**
   - **(A) Fast Path:** gRPC Stream으로 STT Worker(stt)에 즉시 전송
   - **(B) Safe Path:** Redis에 RPUSH로 저장 후 클라이언트에 ACK 전송 (클라이언트 백업 삭제)
3. **[STT Event Pub]** STT Worker가 변환된 텍스트를 Redis(Pub/Sub, Stream)에 발행
4. **[Logic]** Core Service(Spring Boot)가 Redis Stream에서 텍스트 수신
   - Redis에서 대화 맥락(이전 QnA 히스토리) 조회
   - LLM에 gRPC로 질의 (토큰 스트리밍 요청)
5. **[Streaming]** LLM이 토큰 스트림 반환
   - Core가 문장 부호 기준으로 조립
   - 완성된 문장을 Kafka(`BotQuestion`)로 발행
6. **[TTS Output]** TTS Worker(tts)가 문장 수신
   - Edge-TTS 또는 OpenAI TTS로 오디오 변환
   - gRPC Stream으로 Socket에 전달
   - Socket.IO `audio_chunk` 이벤트로 사용자 재생
7. **[Archive]** Storage Worker(storage)가 백그라운드에서:
   - Redis의 오디오를 BLPOP으로 순차 처리
   - Object Storage(OCI/S3)로 업로드
   - 완료 이벤트 발행 → Core의 Gap Filling 트리거

## 7. 설정 / 시크릿 스냅샷

- **BFF**: `CORE_GRPC_URL`, `LLM_GRPC_URL`, `JWT_SECRET`, `KAFKA_BROKER`, `REDIS_HOST/PORT`
- **Core**: `CORE_GRPC_PORT`(9090), `LLM_GRPC_URL`, DB(ATP/AJD), Kafka, Redis
  - CQRS: Command → ATP (RDBMS), Query → AJD (MongoDB 호환)
- **Socket**: `STT_GRPC_URL`, `KAFKA_BROKER`, `REDIS_HOST/PORT`
- **LLM**: `OPENAI_API_KEY`, `GRPC_PORT`(50051), Kafka, Redis
- **stt**:
  - `STT_GRPC_PORT`(50052), `KAFKA_BROKER`, `OPENAI_API_KEY`
  - `REDIS_HOST/PORT`
- **tts**:
  - `KAFKA_BROKER`, `OPENAI_API_KEY`, `REDIS_HOST/PORT`
- **storage**:
  - `KAFKA_BROKER`, `REDIS_HOST/PORT`, `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_BUCKET`
- **공통**: `ocir-secret`(prod), 로컬은 `IfNotPresent` 또는 `kind load`

## 8. 로컬 vs 프로덕션 배포 전략

- 로컬: `kind` 2-worker 구성 (pool=main, pool=infra) — Redis Master/Replica, Kafka 2-broker
- 프로덕션: Pool A (Main, 안정) + Pool B (Infra, Preemptible) + Pool C (Triton, 선택)
- 이미지 레지스트리: OCIR (prod), 로컬은 `IfNotPresent` 또는 `kind load`

## 9. Kafka / Redis HA 요약

- Kafka: 2-broker (Replication Factor=2, min.insync.replicas=1). Pool A가 Controller 역할.
- Redis: Master(Pool A) + Replica(Pool B), Sentinel 3개로 자동 failover, Master에 AOF 활성화

## 10. LLM/STT/TTS/Storage 역할 분리

- **LLM** (`services/llm`): LangChain/RAG 오케스트레이션, 토큰 스트리밍 생성 (gRPC Server)
- **stt** (`services/stt`): STT gRPC 서버
  - `api/grpc_server.py` / `service/stt_service.py`: gRPC Server (Fast Path)
- **tts** (`services/tts`): TTS Kafka Consumer
  - `tts_consumer.py`: `BotQuestion` → Redis 오디오 저장
  - `tts_worker.py`: TTS 엔진 모듈 (Edge/OpenAI)
- **storage** (`services/storage`): gRPC Server + Storage Worker
  - `storage_worker.py`: 업로드 후 `storage.completed` 이벤트 발행
- **Triton** (Optional): GPU 기반 고성능 모델 서빙 (대규모 추론 전용, 향후 테스트)

### 워커 배포 전략

- **stt**: CPU 노드 (Pool A/B), gRPC + Kafka 워커 분리
- **tts**: CPU 노드, Kafka 워커 전용
- **storage**: CPU 노드, 업로드 워커 전용
- **LLM**: CPU 노드, Ampere A1 최적화
- **Triton**: GPU 노드 (Pool C, NVIDIA T4/A10), 별도 스케일링

## 11. 보안·시크릿 운영 팁

- 필수 시크릿: `llm-secrets` (OPENAI_API_KEY 등), `oracle-db-credentials`, `ocir-secret` 등
- 네트워크: gRPC는 내부 서비스 전용, Ingress는 BFF/Socket 중심. TLS는 Ingress + WebSocket 호환 확인
- 로그/PII: 음성·채점 데이터는 최소한으로 저장, 중앙 로깅 시 마스킹

## 12. 중복·오염 정보 정리 포인트

아래 항목들은 `docs/obsolete_summary.md`에 체크리스트로 정리되어 있습니다.

- `.env` 변수는 `REPO_LLM`, `REPO_STT`, `REPO_TTS`, `REPO_STORAGE` 등 서비스별 `REPO_*`를 사용
- `.github/copilot-instructions.md`의 역사적 언급들(‘Inference’)은 운영 문맥에 따라 정리 필요
- `k8s/apps/inference` 매니페스트가 남아있을 경우, Triton 전용으로 보관하거나 `llm`으로 통합 필요 (기본 배포 대상은 `llm`)

## 13. 문서 병합 목록 (원본 참조)

- 병합된 주요 소스: `docs/architecture.md`, `docs/design-decisions.md`, `archive/docs/llm_migration_summary.md`, `archive/docs/obsolete_summary.md`, `docs/FAILURE_ANALYSIS.md`
- 상세 구현 및 운영 지침은 원본 파일에서 확인하세요.

추가로, Docker 최적화 및 이미지 관련 문서는 모두 `archive/docs/`로 이전되었습니다.

## 14. 권장 다음 작업 (우선순위)

1. 레포 전체에서 `inference` 키워드 전수 검색 및 의도 분류(자동 스윕)
2. CI에서 `services/llm` 빌드/배포 파이프라인 실행 검증
3. 문서 용어 정리: `Inference`(Triton 모델서빙) vs `LLM`(오케스트레이션)
4. 불필요 문서(중복된 매뉴얼/예전 가이드) 아카이브 처리 또는 `archive/docs/`로 이동

---

원본 문서로 더 깊게 파고들기를 원하시면, 통합 문서에서 참조된 특정 섹션(예: Redis HA, Kafka 토픽 설계, 로컬 kind 배포 스크립트)을 지정해 주세요. 제가 해당 섹션을 확장하여 별도의 실행 가이드나 체크리스트로 만들어 드리겠습니다.
