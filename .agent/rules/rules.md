---
trigger: always_on
---

# AI Agent Rules

## 필수 준수 사항

0. 답변과 플랜은 항상 한글로 응답하세요.
1. **아키텍처 우선 참조**: 질문에 답변할 때는 항상 `@docs/architecture.md` 파일 내용을 우선적으로 참고하세요.
2. **의사결정 기록**: 지금까지 고민했던 사항들은 항상 `@docs/design-decisions.md` 파일에 작성해주세요.
3. **비용 고려**: 새로운 인프라 도입 시 항상 `@archive/docs/oracle-cloud-always-free.md` 파일의 내용을 참고하여 비용에 대한 내용도 추가해주세요.
4. **코딩 컨벤션 준수**: 코드를 작성할 때는 `@docs/coding_convention.md`의 규칙을 따라야 합니다.
5. **변경 이력 기록**: 코드를 다 작성하면 진행한 작업을 간단히 `@docs/CHANGELOG.md` 파일에 업데이트 진행하는데 이는 백그라운드에서 해주세요.

## 아키텍처 핵심 원칙

### 서비스 경계 및 통신

- **BFF** (Node.js/NestJS): API 게이트웨이, JWT 인증, REST 프론트엔드
- **Core** (Java/Spring Boot): 도메인 로직, gRPC 서버, DB(Oracle/PostgreSQL), 토큰 스트리밍 버퍼링
- **Socket** (Node.js/NestJS): 실시간 WebSocket, Kafka producer/consumer, gRPC client to STT/LLM, Dual-Write 구현
- **LLM** (Python/FastAPI): gRPC 서버, LangChain/RAG 오케스트레이션, 토큰 스트리밍 생성
- **STT** (Python): gRPC 서버, 음성-텍스트 변환, Redis Pub/Sub/Streams 발행
- **TTS** (Python): Kafka Consumer, 텍스트-음성 변환, Redis Pub/Sub 발행
- **Storage** (Python): Redis Queue Consumer, Object Storage 업로드, Kafka 이벤트 발행

### 통신 프로토콜

- **외부 클라이언트 → BFF**: REST (HTTP)
- **BFF ↔ Core**: gRPC (포트 9090)
- **Socket ↔ STT**: gRPC Streaming (포트 50052)
- **Socket ↔ LLM**: gRPC Streaming (포트 50051)
- **Core ↔ LLM**: gRPC Streaming (포트 50051)
- **서비스 간**: Kafka (비동기 이벤트), Redis (Pub/Sub, Queue, Streams, Cache)
- **Socket ↔ Frontend**: Socket.IO (WebSocket)

### 데이터 흐름 패턴

1. **Hybrid Dual-Write (입력)**:
   - Fast Path: Socket → gRPC Stream → STT (실시간 처리)
   - Safe Path: Socket → Redis Queue → Storage → Object Storage (안전 저장)

2. **Streaming Pipeline (처리)**:
   - STT → Kafka → Core → LLM (gRPC Streaming) → Core
   - Core에서 토큰 단위 버퍼링, 문장 단위 Pub/Sub 발행

3. **이벤트 기반 출력**:
   - TTS: Kafka Queue → TTS Worker → Redis Pub/Sub → Socket → Client
   - 실시간 자막: Redis Pub/Sub → Socket → Client

## Clean Architecture 원칙 (Core Service)

### 계층 구조

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
├─ service/            → Domain Service (여러 엔티티에 걸친 로직)
└─ exception/          → Domain Exception
adapter/out/           → Output Adapter (기술 구현체)
├─ persistence/        → JPA Repository + Adapter
└─ cache/              → Redis Adapter
```

### 네이밍 규칙

- **UseCase 구현체**: `~Interactor` (NOT `~Service`)
- **Adapter**: `~PersistenceAdapter`, `~GrpcController`, `~CacheAdapter`
- **Domain Entity**: 순수 자바 클래스 (JPA `@Entity` 사용 금지)
- **JPA Entity**: `adapter/out/persistence/entity/` 패키지, `~JpaEntity` 접미사

## gRPC 패턴

### NestJS gRPC 클라이언트 초기화

**항상 `OnModuleInit` 라이프사이클 훅 사용:**

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

**이유**: gRPC 클라이언트는 모듈 초기화 후에만 준비됩니다. 생성자에서 호출하면 undefined가 반환됩니다.

### gRPC 스트리밍 Keep-Alive

**Socket → STT gRPC 스트리밍**:

- `grpc.keepalive_time_ms: 10000` (10초마다 핑)
- `grpc.keepalive_permit_without_calls: true` (침묵 시에도 핑)
- Persistent stream 패턴 (인터뷰 세션당 단일 스트림 유지)

**Core → LLM gRPC 스트리밍**:

- Spring Boot `grpc.client.llm-server.enable-keep-alive: true`
- `keep-alive-without-calls: true` (필수)

### gRPC 재연결 로직

- 스트림 에러 발생 시 자동 재연결 (Exponential Backoff)
- `sessionId`를 메타데이터에 포함하여 맥락 유지
- 재연결 시 이전 대화 맥락 복구

### gRPC Client Guidelines (Java)

- **Safe Lookup**: `loadBy...`, `findBy...` 등 조회 메서드 구현 시 반드시 `GrpcClientUtils.callToOptional`을 사용하세요.
- **Reason**: `NOT_FOUND` 또는 `INVALID_ARGUMENT` 에러를 Safe하게 처리하여 `Optional.empty()`를 반환하기 위함입니다. 직접 try-catch 하지 마세요.

## Redis 패턴

### Redis 사용 용도별 구분

- **Cache**: LLM 스트리밍 데이터 백업 (APPEND, TTL)
- **Queue**: 오디오 청크 큐잉 (LPUSH/BLPOP)
- **Pub/Sub**: 실시간 자막, TTS 오디오 전송
- **Streams**: 신뢰성 있는 메시지 처리 (STT transcript)

### Redis 키 네이밍

- 계층 구조: `domain:resource:action:{id}`
- 예시: `interview:audio:queue:{interviewId}`, `stt:transcript:pubsub`, `interview:transcript:{interviewId}`

## Kafka 패턴

### 토픽 구조

- `UserAnswer`: STT → Core (사용자 발화 텍스트)
- `BotQuestion`: Core → TTS (AI 응답 문장, 문장 단위)
- `storage.completed`: Storage → Core (파일 업로드 완료)

### 파티션 키

- **반드시 `sessionId` 또는 `interviewId`를 파티션 키로 지정**
- 이유: 같은 면접의 메시지가 순서대로 처리되어야 함 (문맥 보존)

## 에러 처리

### gRPC Exception Handling (Java)

모든 gRPC 컨트롤러는 `GlobalGrpcExceptionHandler` 사용:

```java
catch (Exception e) {
  io.grpc.Status status = GlobalGrpcExceptionHandler.toGrpcStatus(e);
  responseObserver.onError(status.asRuntimeException());
}
```

### Domain Exception → gRPC Status 매핑

- `UserAlreadyExistsException` → `ALREADY_EXISTS`
- `InvalidPasswordException` → `UNAUTHENTICATED`
- `UserNotFoundException` → `NOT_FOUND`
- `DomainException` (기타) → `INVALID_ARGUMENT`

## Proto 파일 관리

- **중앙 관리**: 모든 Proto 파일은 `services/proto/`에 위치
- **컴파일**: 각 서비스별로 자동/수동 컴파일
  - Java: Gradle protobuf plugin
  - Node.js: @grpc/proto-loader (런타임 로드)
  - Python: `grpc_tools.protoc` (수동 컴파일)

## 문서 참조

- **아키텍처**: `docs/architecture.md`, `docs/architecture_consolidated.md`, `docs/architecture-diagrams.md`
- **코딩 컨벤션**: `docs/coding_convention.md`
- **의사결정**: `docs/design-decisions.md`
- **환경 변수**: `docs/environment-variables.md`
- **운영 가이드**: `docs/ops_consolidated.md`
- **서비스별 아키텍처**: `services/{service}/ARCHITECTURE.md`
