# AI Coding Agent Instructions

## 필수 준수 사항

1. **항상 `.cursorrules` 파일을 먼저 읽으세요**
2. **의사결정 기록**: 지금까지 고민했던 사항들은 항상 `docs/design-decisions.md` 파일에 작성해주세요
3. **변경 이력 기록**: 한 작업이 끝나면 `docs/CHANGELOG.md`에 무슨 작업을 진행했는지에 대한 내용을 남겨주세요

---

## 프로젝트 개요

**AI 기반 실시간 면접 솔루션** - 음성 인식, LLM 기반 면접관 응답, 실시간 대화를 지원하는 이벤트 기반 마이크로서비스 아키텍처.

**핵심 서비스:**

- **BFF** (Node.js/NestJS): API 게이트웨이, JWT 인증, REST 프론트엔드
- **Core** (Java/Spring Boot): 도메인 로직, gRPC 서버, DB(Oracle/PostgreSQL), 토큰 스트리밍 버퍼링
- **Socket** (Node.js/NestJS): 실시간 WebSocket, Kafka producer/consumer, gRPC client to STT/LLM, Dual-Write 구현
- **LLM** (Python/FastAPI): gRPC 서버, LangChain/RAG 오케스트레이션, 토큰 스트리밍 생성
- **STT** (Python): gRPC 서버, 음성-텍스트 변환, Redis Pub/Sub/Streams 발행
- **TTS** (Python): Kafka Consumer, 텍스트-음성 변환, Redis Pub/Sub 발행
- **Storage** (Python): Redis Queue Consumer, Object Storage 업로드, Kafka 이벤트 발행
- **Inference/Triton** (GPU, 향후): GPU 모델 서빙 전용, 기본 빌드/배포 대상 아님

---

## 핵심 아키텍처 패턴

### 1. 서비스 경계 및 통신

**통신 프로토콜:**

- **외부 클라이언트 → BFF**: REST (HTTP)
- **BFF ↔ Core**: gRPC (포트 9090)
- **Socket ↔ STT**: gRPC Streaming (포트 50052)
- **Socket ↔ LLM**: gRPC Streaming (포트 50051)
- **Core ↔ LLM**: gRPC Streaming (포트 50051)
- **서비스 간**: Kafka (비동기 이벤트), Redis (Pub/Sub, Queue, Streams, Cache)
- **Socket ↔ Frontend**: Socket.IO (WebSocket)

**서비스별 역할:**

- **BFF**: JWT 검증 전담, 내부 서비스는 `X-User-Id` 헤더 신뢰
- **Core**: 도메인 로직, 비즈니스 규칙, DB 트랜잭션
- **Socket**: 실시간 양방향 통신, 오디오 스트리밍 오케스트레이션
- **LLM**: AI 응답 생성, LangGraph 기반 면접 시나리오
- **STT**: 실시간 음성 인식, VAD 기반 자동 종료
- **TTS**: 문장 단위 음성 생성, 모드별 엔진 선택
- **Storage**: 오디오 아카이빙, Object Storage 업로드

### 2. Hybrid Dual-Write 전략 (입력)

오디오 데이터 처리는 **속도와 안전을 동시에 확보**하기 위해 이중 경로를 사용합니다:

**⚡ Fast Path (속도 우선):**

```
Client → Socket → gRPC Stream → STT Worker
```

- 실시간 STT 변환 (지연 최소화)
- Kafka `UserAnswer` 이벤트 즉시 발행

**🛡️ Safe Path (안전 우선):**

```
Client → Socket → Redis Queue → Storage Worker → Object Storage
```

- 원본 오디오 안전 저장 (데이터 유실 방지)
- 비동기 처리로 실시간 성능 영향 없음

**🔄 Client Retry (최후의 보루):**

- 클라이언트가 서버 ACK를 받을 때까지 재전송
- MediaRecorder API 기반 청크 백업

### 3. Streaming Pipeline 전략 (처리)

**토큰 단위 스트리밍:**

```
STT → Kafka → Core → LLM (gRPC Streaming) → Core
```

**Core의 지능형 버퍼링:**

- 토큰을 모으다가 **문장 부호(. ? !)** 감지 시 즉시 Kafka 발행
- LLM이 뒷내용 생성하는 동안 사용자는 앞 문장 TTS를 듣게 됨
- **체감 대기 시간 < 1초** 달성

**Redis 다중 발행:**

1. **Cache (APPEND)**: 네트워크 끊김 대비 백업
2. **Pub/Sub**: 실시간 자막 (Socket → Client)
3. **Queue**: TTS용 문장 단위 발행

### 4. gRPC Service Initialization Pattern

**NestJS gRPC 클라이언트는 항상 `OnModuleInit` 사용:**

```typescript
@Injectable()
export class MyService implements OnModuleInit {
  private grpcService: MyServiceGrpc;
  constructor(@Inject("PACKAGE_NAME") private client: ClientGrpc) {}

  onModuleInit() {
    // Must call getService() here, NOT in constructor
    this.grpcService = this.client.getService<MyServiceGrpc>("ServiceName");
  }
}
```

**이유**: gRPC 클라이언트는 모듈 초기화 후에만 준비됩니다.

### 5. Clean Architecture Layers (Core Service)

**엄격한 4계층 모델 준수:**

```
adapter/in/grpc/       → Inbound: @GrpcService, inherit *ImplBase
├─ *GrpcController     → Receives gRPC requests, maps to UseCase
application/           → UseCase implementations, business logic
├─ port/in/            → Input Port (UseCase 인터페이스)
├─ port/out/           → Output Port (Repository 인터페이스)
├─ interactor/         → UseCase 구현체 (NOT *Service)
└─ dto/                → Command/Result DTO
domain/                 → Pure business logic, framework-agnostic
├─ entity/             → Domain Entity (순수 자바, JPA 없음)
├─ service/            → Domain Service
└─ exception/          → Domain Exception
adapter/out/           → Output Adapter (기술 구현체)
├─ persistence/        → JPA Repository + Adapter
└─ cache/              → Redis Adapter
```

**핵심 규칙:**

- Domain Entity는 순수 자바 객체 (JPA `@Entity` 사용 금지)
- JPA Entity는 `adapter/out/persistence/entity/` 패키지, `~JpaEntity` 접미사
- UseCase 구현체는 `~Interactor` (NOT `~Service`)
- Adapter는 역할별 접미사 (`PersistenceAdapter`, `GrpcController` 등)

### 6. gRPC 스트리밍 Keep-Alive 및 재연결

**Keep-Alive 설정 (연결 유지):**

**Node.js (Socket → STT):**

```typescript
const client = new services.STTClient("stt:50052", credentials, {
  "grpc.keepalive_time_ms": 10000,
  "grpc.keepalive_timeout_ms": 5000,
  "grpc.keepalive_permit_without_calls": 1, // 침묵 시 필수
  "grpc.http2.max_pings_without_data": 0,
});
```

**Spring Boot (Core → LLM):**

```yaml
grpc:
  client:
    llm-server:
      enable-keep-alive: true
      keep-alive-time: 10s
      keep-alive-without-calls: true # 필수
```

**재연결 로직:**

- 스트림 에러 발생 시 자동 재연결 (Exponential Backoff)
- `sessionId`를 메타데이터에 포함하여 맥락 유지
- 재연결 시 이전 대화 맥락 복구
- Persistent stream 패턴 (인터뷰 세션당 단일 스트림 유지)

### 6.1 gRPC Client Guidelines (Java)

- **Safe Lookup**: `loadBy...`, `findBy...` 등 조회 메서드 구현 시 반드시 `GrpcClientUtils.callToOptional`을 사용하세요.
- **Reason**: `NOT_FOUND` 또는 `INVALID_ARGUMENT` 에러를 Safe하게 처리하여 `Optional.empty()`를 반환하기 위함입니다. 직접 try-catch 하지 마세요.

### 7. Redis 패턴

**용도별 구분:**

- **Cache**: LLM 스트리밍 데이터 백업 (`APPEND`, TTL)
- **Queue**: 오디오 청크 큐잉 (`LPUSH`/`BLPOP`)
- **Pub/Sub**: 실시간 자막, TTS 오디오 전송
- **Streams**: 신뢰성 있는 메시지 처리 (STT transcript)

**키 네이밍 규칙:**

- 계층 구조: `domain:resource:action:{id}`
- 예시: `interview:audio:queue:{interviewId}`, `stt:transcript:pubsub`

### 8. Kafka 패턴

**토픽 구조:**

- `UserAnswer`: STT → Core (사용자 발화 텍스트)
- `BotQuestion`: Core → TTS (AI 응답 문장, 문장 단위)
- `storage.completed`: Storage → Core (파일 업로드 완료)

**파티션 키 필수:**

- **반드시 `sessionId` 또는 `interviewId`를 파티션 키로 지정**
- 이유: 같은 면접의 메시지가 순서대로 처리되어야 함 (문맥 보존)

---

## 개발 워크플로우

### 로컬 개발

```bash
# Core Service (Java)
cd services/core && ./gradlew bootRun

# BFF (Node.js)
cd services/bff && pnpm install && pnpm start:dev

# Socket (Node.js)
cd services/socket && pnpm install && pnpm start:dev

# LLM (Python)
cd services/llm && uv run main.py

# STT (Python)
cd services/stt && uv run main.py

# TTS (Python)
cd services/tts && python main.py

# Storage (Python)
cd services/storage && uv run main.py
```

### Proto 파일 변경 후

```bash
# Java: Gradle이 자동 처리
cd services/core && ./gradlew build

# Node.js: @grpc/proto-loader (런타임 자동 로드)
# 별도 컴파일 불필요

# Python: 수동 컴파일
cd services/llm && python -m grpc_tools.protoc \
  -I../proto --python_out=. --grpc_python_out=. ../proto/llm.proto
```

---

## 프로젝트별 컨벤션

### 환경 변수

**Core:**

- `CORE_GRPC_PORT`: 기본값 9090
- Database: Oracle (프로덕션) / PostgreSQL (로컬)

**BFF:**

- `CORE_GRPC_URL`: 기본값 `core:9090`
- `LLM_GRPC_URL`: 기본값 `llm:50051` (호환: `INFERENCE_GRPC_URL`)
- `REDIS_HOST`, `REDIS_PORT`: 기본값 `redis:6379`
- `KAFKA_BROKER`: 기본값 `kafka:29092`
- `JWT_SECRET`: JWT 토큰 서명용

**Socket:**

- `STT_GRPC_URL`: 기본값 `stt:50052`
- `LLM_GRPC_URL`: 기본값 `llm:50051`
- `REDIS_SENTINEL_HOSTS`: Redis Sentinel 주소 리스트
- `KAFKA_BROKER`: 기본값 `kafka-cluster-kafka-bootstrap.kafka:9092`

**LLM:**

- `OPENAI_API_KEY`: OpenAI API 키 (필수)
- `GRPC_PORT`: 기본값 50051
- `REDIS_HOST`, `REDIS_PORT`: Redis 연결 정보

**STT:**

- `STT_GRPC_PORT`: 기본값 50052
- `REDIS_HOST`, `REDIS_PORT`: Redis 연결 정보
- `WHISPER_MODEL_SIZE`: 기본값 `small`

**TTS:**

- `KAFKA_BROKER`: Kafka 브로커 주소
- `REDIS_HOST`, `REDIS_PORT`: Redis Pub/Sub용

**Storage:**

- `REDIS_HOST`, `REDIS_PORT`: Redis Queue용
- `OBJECT_STORAGE_ENDPOINT`: MinIO/OCI Object Storage 엔드포인트
- `KAFKA_BROKER`: 완료 이벤트 발행용

자세한 내용은 `docs/environment-variables.md` 참고.

### 면접 도메인 (Core)

- **Persona Types**: `PRESSURE`, `COMFORTABLE`, `RANDOM`
- **Interview Status**: `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
- **TTS Modes**: `practice` (Edge-TTS, 무료) / `real` (OpenAI TTS, 유료)
- **STT Modes**: `practice` (Faster-Whisper, 로컬) / `real` (OpenAI Whisper API)

### Socket Event Naming

**`domain:action` 패턴 사용:**

| 방향                  | 패턴               | 예시                    | 설명             |
| --------------------- | ------------------ | ----------------------- | ---------------- |
| Client → Server       | `domain:action`    | `interview:audio_chunk` | 오디오 청크 전송 |
| Server → Client       | `domain:action`    | `interview:stt_result`  | STT 결과 전송    |
| Server → Client (Ack) | `domain:ack_type`  | `interview:audio_ack`   | 오디오 수신 확인 |
| Error                 | `domain:error`     | `interview:error`       | 도메인 에러      |
| Error                 | `connection:error` | `connection:error`      | 연결 에러        |

---

## 문서 참조

- **아키텍처**: `docs/architecture.md` - 시스템 설계, 데이터 흐름, AI 전략
- **코딩 표준**: `docs/coding_convention.md` - 네이밍, 계층 구조, 패턴
- **의사결정**: `docs/design-decisions.md` - 기술 선택 (UUIDv7, LangGraph 등)
- **환경 설정**: `docs/environment-variables.md` - 로컬/K8s 설정
- **운영 가이드**: `docs/ops_consolidated.md` - 배포 및 운영 요약
- **CHANGELOG**: `docs/CHANGELOG.md` - 최신 기능 (주요 변경 후 업데이트)

---

## 주요 파일 참조

| 항목             | 위치                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------ |
| gRPC proto 파일  | `services/proto/*.proto`                                                                   |
| Auth 플로우      | `services/core/src/.../auth/adapter/in/grpc/AuthGrpcController.java`                       |
| 면접 생성        | `services/core/src/.../interview/...`, `services/bff/src/interviews/interviews.service.ts` |
| 실시간 TTS       | `services/socket/src/events/events.gateway.ts`, `services/llm/service/grpc_handler.py`     |
| gRPC 예외 처리   | `services/core/src/.../adapter/in/grpc/GlobalGrpcExceptionHandler.java`                    |
| Socket 아키텍처  | `services/socket/ARCHITECTURE.md`                                                          |
| LLM 아키텍처     | `services/llm/ARCHITECTURE.md`                                                             |
| STT 아키텍처     | `services/stt/ARCHITECTURE.md`                                                             |
| Storage 아키텍처 | `services/storage/ARCHITECTURE.md`                                                         |

---

## 코드 병합 전 체크리스트

1. **컨벤션 참조**: 불확실한 경우 `docs/coding_convention.md` 확인
2. **기존 패턴 준수**: 유사한 모듈 구조 복사 (예: auth 모듈 참고)
3. **CHANGELOG 업데이트**: `docs/CHANGELOG.md`에 간단 요약 추가
4. **gRPC 변경 검증**: Proto 파일 컴파일 및 서비스 통신 확인
5. **환경 변수 문서화**: 새 설정은 `docs/environment-variables.md`에 추가

---

## 실시간 면접 플로우 (E2E)

**전체 흐름:**

1. **사용자 음성 입력**:
   - Client → Socket: `interview:audio_chunk` (PCM16, 16kHz)
   - Socket → STT: gRPC Streaming (Fast Path)
   - Socket → Redis Queue: LPUSH (Safe Path)

2. **STT 변환**:
   - STT → Redis Pub/Sub/Streams: `stt:transcript:pubsub`
   - Socket 구독 → Client: `interview:stt_result`

3. **LLM 응답 생성**:
   - STT → Kafka: `UserAnswer` 이벤트
   - Core → LLM: gRPC Streaming 요청
   - LLM → Core: 토큰 단위 스트리밍 응답
   - Core → Redis: Cache (APPEND), Pub/Sub (실시간 자막), Queue (TTS용 문장)

4. **TTS 생성**:
   - Core → Kafka: `BotQuestion` 이벤트 (문장 단위)
   - TTS → Redis Pub/Sub: `interview:audio:{interviewId}`
   - Socket 구독 → Client: `interview:ai_response_audio_chunk`

5. **최종 저장**:
   - Core → PostgreSQL: 완료 시 최종 응답 저장
   - Storage → Object Storage: 원본 오디오 업로드
   - Storage → Kafka: `storage.completed` 이벤트

---

## 핵심 최적화 포인트

### 프론트엔드

- 고품질 리샘플링: 선형 보간 (44100Hz → 16000Hz)
- 다중 정규화: 청크별 + WAV 생성 시
- 버퍼 최적화: 8192 샘플
- Mac 최적화: echoCancellation OFF, 44100Hz

### 백엔드

- 서버 VAD: 침묵 자동 감지 (1.5초)
- 듀얼 모드: practice (무료) / real (정확)
- 폴백 전략: OpenAI 실패 → Faster-Whisper
- Persistent gRPC 스트림: 연결 안정성

### 자연 대화

- 양방향 VAD: 프론트 + 서버 침묵 감지
- 상태 머신: IDLE → LISTENING → PROCESSING → SPEAKING
- 자동 재녹음: TTS 완료 후 즉시 시작
