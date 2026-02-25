---
trigger: always_on
---

# 🏗️ AI Interview Solution - Project Convention & Architecture

본 문서는 OCI 프리티어 기반 하이브리드 AI 면접 솔루션 프로젝트의 개발 표준과 아키텍처 원칙을 정의합니다. 모든 기여자는 이 컨벤션을 준수해야 합니다.

---

## 1. 🏛️ Core Architecture Principles

우리는 **Clean Architecture (Hexagonal Architecture)** 와 **DDD (Domain-Driven Design)** 원칙을 따릅니다.

### 1.1 Gateway Offloading Pattern

- **BFF (Backend For Frontend)** 가 마이크로 서비스 오케스트레이터 역할을 수행합니다.
- **Authentication:** BFF에서 JWT 검증을 전담합니다.
- **Trust Zone:** 내부 마이크로서비스(Core, Inference)는 인증 로직을 수행하지 않고, 헤더로 전달된 `X-User-Id`를 신뢰합니다.
- **Communication:** 외부 통신은 `REST`, 내부 통신(BFF ↔ Core)은 `gRPC`를 사용합니다.

### 1.2 Separation of Concerns (관심사의 분리)

- **Domain:** 순수 비즈니스 로직. 프레임워크나 DB 기술에 의존하지 않습니다.
- **Application:** 유스케이스 흐름 제어 (What the system does).
- **Adapter:** 외부 세계(Web, DB, gRPC)와 내부를 연결하는 변환기.

---

## 2. 📂 Directory Structure & Packaging

**"패키지 구조가 아키텍처를 소리치게 하라(Screaming Architecture)"** 원칙에 따라, 기능의 의도가 명확히 드러나도록 구성합니다.

### 🎨 프로젝트 루트 구조

```bash
ai-interview-project/
├── frontend/          # React 클라이언트 앱 (정적 파일)
├── services/          # 백엔드 마이크로서비스
│   ├── bff/          # Backend For Frontend (NestJS)
│   ├── core/         # Core 비즈니스 로직 (Java)
│   ├── socket/       # WebSocket 서비스 (NestJS)
│   ├── llm/          # LLM 오케스트레이션 (Python)
│   ├── document/     # 이력서 분석/VLM 서비스 (Python)
│   ├── stt/          # STT 서비스 (Python)
│   ├── tts/          # TTS 서비스 (Python)
│   ├── storage/      # Object Storage 서비스 (Python)
│   └── proto/        # 중앙 Proto 정의 (공유)
├── k8s/              # Kubernetes 매니페스트
├── scripts/          # 빌드/배포 스크립트
└── docs/             # 문서
```

**구조 원칙:**

- **`frontend/`**: 클라이언트 앱 (React, HTTP/WebSocket 클라이언트)
- **`services/`**: 백엔드 서비스 (gRPC, Kafka, Redis 서버)

### 📡 Proto Definition (중앙 관리)

모든 gRPC Proto 파일은 **`services/proto/`** 에 중앙 관리됩니다. 폴리글랏 환경에서 모든 서비스가 공유하는 단일 소스입니다.

```protobuf
services/proto/                    # 중앙 Proto 정의 (폴리글랏)
├── auth.proto                      # Auth Service (Java/Go/etc)
├── interview.proto                 # Interview Service (Java)
├── resume.proto                    # Resume Service (Java)
├── llm.proto                       # LLM Service (Python)
├── document.proto                  # Document Service (Python)
├── stt.proto                       # STT Worker (Python)
└── storage.proto                   # Storage Service (Python)
```

**각 서비스별 Proto 컴파일 방식:**

| 서비스    | 언어    | 컴파일 방법                 | 출력 위치                   |
| --------- | ------- | --------------------------- | --------------------------- |
| Core/Auth | Java    | Gradle protobuf plugin      | `build/generated/main/java` |
| BFF       | Node.js | @grpc/proto-loader (런타임) | (Runtime Load)              |
| LLM       | Python  | protoc 커맨드               | `generated/`                |
| Document  | Python  | protoc 커맨드               | `generated/`                |
| STT       | Python  | protoc 커맨드               | `generated/`                |

**Proto 파일 작성 규칙:**

```protobuf
syntax = "proto3";

package auth;  // 소문자 패키지명

// Java 옵션 (Java 서비스만)
option java_package = "me.unbrdn.auth.grpc";
option java_outer_classname = "AuthProto";

// Node.js에서도 활용 가능 (js_out 옵션 추가 가능)

service AuthService {
  rpc Signup (SignupRequest) returns (SignupResponse);
}
```

**Proto 파일 수정 후 처리:**

```bash
# Java (Gradle이 자동 처리)
cd services/auth && ./gradlew clean build

# Node.js (@grpc/proto-loader 사용, 런타임 자동 로드)
# 별도 컴파일 불필요 (src/proto 참조)

# Python (수동 컴파일 필수)
python -m grpc_tools.protoc -I./services/proto \
  --python_out=. --grpc_python_out=. \
  services/proto/llm.proto
```

### 🏛️ Current Architecture: 모놀리식 Core Service (DDD + Hexagonal)

**Package Root:** `me.unbrdn.core`

```
src/main/java/me/unbrdn/core
├── domain                   # [Domain Layer] JPA 어노테이션 허용
│   ├── entity               # 핵심 도메인 객체 (@Entity가 붙은 도메인 객체)
│   │   └── User.java        # 필드 + 비즈니스 메서드 + @Entity
│   ├── enums                # 도메인 전반에서 사용되는 상수 집합
│   │   ├── UserRole.java
│   │   ├── UserStatus.java
│   │   └── InterviewStatus.java
│   └── exception            # 비즈니스 규칙 위반 시 발생하는 도메인 예외
│       ├── DomainException.java          # 모든 도메인 예외의 최상위 클래스
│       ├── UserAlreadyExistsException.java
│       └── InvalidPasswordException.java
│
├── application              # [Application Layer] 비즈니스 흐름 조율 & 유스케이스
│   ├── port
│   │   ├── in               # [Input Port] 외부에서 애플리케이션을 호출하는 인터페이스
│   │   │   ├── RegisterUserUseCase.java     # "회원가입을 하고 싶어"
│   │   │   ├── AuthenticateUserUseCase.java # "로그인을 하고 싶어"
│   │   │   └── CreateInterviewUseCase.java  # "면접을 생성하고 싶어"
│   │   └── out              # [Output Port] 애플리케이션이 외부 인프라에 요청하는 인터페이스, 여전히 순수 인터페이스 유지 (JpaRepository 상속 금지 ❌)
│   │       ├── LoadUserPort.java            # "유저 정보를 줘"
│   │       ├── SaveUserPort.java            # "유저 정보를 저장해줘"
│   │       ├── CacheUserPort.java           # "유저 정보를 캐싱해줘"
│   │       ├── SendEmailPort.java           # "이메일을 보내줘"
│   │       └── PublishEventPort.java        # "이벤트를 발행해줘" (Kafka)
│   │
│   ├── interactor           # [UseCase 구현체] Input Port 구현, Output Port 호출
│   │   ├── RegisterUserInteractor.java      # 회원가입 흐름 제어
│   │   ├── AuthenticateUserInteractor.java  # 인증 흐름 제어
│   │   └── CreateInterviewInteractor.java   # 면접 생성 흐름 제어
│   │
│   ├── dto                  # Application 계층 전용 DTO (Command/Result)
│   │   ├── command
│   │   │   ├── RegisterUserCommand.java
│   │   │   └── CreateInterviewCommand.java
│   │   └── result
│   │       ├── AuthenticateUserResult.java
│   │       └── InterviewCreatedResult.java
│   │
│   └── exception            # Application 계층 예외
│       └── UseCaseException.java
│
└── adapter                  # [Adapter Layer] 기술 구현체 & 인프라 스트럭처
    ├── in                   # [Input Adapter] 외부 요청을 받아 Application으로 전달
    │   ├── http             # REST API 진입점 (BFF 서비스에서 사용)
    │   │   ├── AuthController.java          # HTTP 요청 수신
    │   │   ├── dto
    │   │   │   ├── request                   # HTTP 요청 바디 객체
    │   │   │   │   └── RegisterRequest.java
    │   │   │   └── response                  # HTTP 응답 바디 객체
    │   │   │       └── RegisterResponse.java
    │   │   └── exception                     # HTTP 전용 에러 핸들러
    │   │       ├── GlobalExceptionHandler.java  # @RestControllerAdvice
    │   │       └── ErrorResponse.java
    │   │
    │   ├── grpc             # gRPC API 진입점 (현재 주 진입점)
    │   │   ├── AuthGrpcController.java       # gRPC 요청 수신 및 변환
    │   │   ├── InterviewGrpcController.java
    │   │   └── exception                     # gRPC 전용 에러 핸들러
    │   │       └── GlobalGrpcExceptionHandler.java
    │   │
    │   └── messaging        # [Consumer] 메시지 큐 구독 (Kafka Listener)
    │       └── InterviewEventConsumer.java   # "면접 완료 이벤트 수신 -> 후속 처리"
    │
    └── out                  # [Output Adapter] Application 요청을 받아 실제 기술 실행
        ├── persistence      # 데이터베이스 (JPA + Hibernate)
        │   ├── repository   # Spring Data JPA Repository (extends JpaRepository)
        │   │   └── JpaUserRepository.java    # JpaRepository<UserJpaEntity, UUID>
        │   └── adapter      # Port 구현체 (다리 역할)
        │       ├── UserPersistenceAdapter.java   # LoadUserPort, SaveUserPort 구현
        │       └── InterviewPersistenceAdapter.java
        │
        ├── cache            # 캐시 (Redis)
        │   ├── config
        │   │   └── RedisConfig.java          # Redis 설정
        │   └── adapter
        │       └── UserCacheAdapter.java     # CacheUserPort 구현
        │
        ├── external         # 외부 API 클라이언트
        │   ├── dto          # 외부 API 요청/응답 스펙
        │   │   └── MailApiRequest.java
        │   └── adapter
        │       └── MailServerAdapter.java    # SendEmailPort 구현 (WebClient)
        │
        └── messaging        # [Producer] 메시지 큐 발행 (Kafka Producer)
            ├── dto          # 메시지 페이로드 객체
            │   └── UserCreatedEventDto.java
            └── adapter
                └── KafkaProducerAdapter.java # PublishEventPort 구현
```

### 🚀 Future Architecture: Core MSA 분리 계획

향후 Core 서비스가 여러 독립 MSA로 분리될 경우, 다음 구조를 따릅니다:

```
services/
├── proto/                          # 중앙 Proto 저장소 (공유)
│   ├── auth.proto
│   ├── interview.proto
│   ├── resume.proto
│   └── payment.proto
│
├── auth/                           # 독립적 Auth MSA
│   ├── build.gradle                # 개별 빌드 설정
│   ├── src/main/java/me/unbrdn/auth
│   └── Dockerfile
│
├── interview/                      # 독립적 Interview MSA
│   ├── build.gradle
│   ├── src/main/java/me/unbrdn/interview
│   └── Dockerfile
│
├── resume/                         # 독립적 Resume MSA
│   ├── build.gradle
│   └── src/main/java/me/unbrdn/resume
│
├── payment/                        # 독립적 Payment MSA
│   └── [같은 구조]
│
├── shared/                         # 공유 라이브러리
│   ├── build.gradle
│   └── src/main/java/me/unbrdn/shared
│       ├── exception               # DomainException 등 공통 예외
│       ├── enums                   # 공통 Enum
│       └── util                    # 공통 유틸
│
├── bff/
├── socket/
├── llm/
├── stt/
├── tts/
└── storage/
```

**MSA 분리 시 주요 변경사항:**

| 항목        | 모놀리식 (현재)  | MSA (향후)                                 |
| ----------- | ---------------- | ------------------------------------------ |
| 패키지 루트 | `me.unbrdn.core` | `me.unbrdn.auth`, `me.unbrdn.interview` 등 |
| gRPC Port   | 9090 (core)      | 9091 (auth), 9092 (interview) 등           |
| DB          | 공유 (Oracle)    | 공유 또는 서비스별 분리 가능               |
| 배포        | 단일 JAR         | 각 서비스별 독립 컨테이너                  |
| Proto 참조  | 로컬 proto 폴더  | 중앙 `services/proto`                      |

**MSA 분리 시 실행 예시:**

```bash
# 각 서비스 독립 실행
cd services/auth && ./gradlew bootRun           # :9091
cd services/interview && ./gradlew bootRun      # :9092
cd services/resume && ./gradlew bootRun         # :9093

# Docker Compose (MSA 버전)
docker-compose -f docker-compose.msa.yml up
```

**패키지 네이밍 규칙 (MSA 분리 후):**

```
me.unbrdn.auth.adapter.in.grpc.AuthGrpcController
me.unbrdn.interview.application.service.CreateInterviewInteractor
me.unbrdn.resume.domain.entity.Resume
me.unbrdn.payment.adapter.out.persistence.PaymentPersistenceAdapter
me.unbrdn.shared.exception.DomainException
```

### 🎯 BFF Service (Node.js/NestJS)

**Source Root:** `src/`

```
src/
├── auth                     # Auth 모듈
│   ├── infrastructure       # gRPC Client (Adapter)
│   ├── dto                  # Data Transfer Objects
│   ├── guards               # JWT Auth Guard
│   ├── strategies           # Passport Strategy
│   ├── decorators           # Custom Decorators
│   ├── auth.controller.ts
│   ├── auth.service.ts      # Application Logic
│   └── auth.module.ts
├── interviews               # Interview 모듈
├── resumes                  # Resume 모듈
└── proto                    # gRPC Proto 파일
```

---

## 3. 📝 Naming Conventions

### 3.1 Java (Core Service)

| Layer          | Component              | Suffix / Pattern      | Role / 책임                                                               | Example                                          |
| -------------- | ---------------------- | --------------------- | ------------------------------------------------------------------------- | ------------------------------------------------ |
| Domain         | Domain Entity          | Plain Class           | 핵심 비즈니스 로직과 규칙 보유, 외부 의존성 없는 순수 자바 객체           | `User`, `Interview`, `Resume`                    |
| Domain         | Domain Service         | `~DomainService`      | 여러 엔티티에 걸친 도메인 로직 처리 (암호화, 검증 등)                     | `PasswordEncryptionDomainService`                |
| Domain         | Domain Exception       | `~Exception`          | 비즈니스 규칙 위반 시 발생하는 도메인 전용 예외                           | `UserAlreadyExistsException`                     |
| Input Port     | UseCase Interface      | `~UseCase`            | 외부에서 애플리케이션에 요청할 수 있는 작업 정의 (계약)                   | `RegisterUserUseCase`, `AuthenticateUserUseCase` |
| Application    | UseCase Implementation | `~Interactor`         | UseCase 실제 구현, 비즈니스 흐름 조율 및 Port 호출                        | `RegisterUserInteractor` (Not `~Service`)        |
| Application    | Command DTO            | `~Command`            | UseCase 입력 데이터 전달 객체 (불변 권장)                                 | `RegisterUserCommand`, `CreateInterviewCommand`  |
| Application    | Result DTO             | `~Result`             | UseCase 출력 데이터 전달 객체 (불변 권장)                                 | `AuthenticateUserResult`, `InterviewResult`      |
| Output Port    | Repository Interface   | `~Port`               | 애플리케이션이 외부 인프라(DB/Cache/API)에 요청하는 작업 정의             | `LoadUserPort`, `SaveUserPort`, `CacheUserPort`  |
| Input Adapter  | gRPC Controller        | `~GrpcController`     | gRPC 요청 수신, Proto → Command 변환, UseCase 호출, Result → Proto 변환   | `AuthGrpcController`, `InterviewGrpcController`  |
| Input Adapter  | HTTP Controller        | `~Controller`         | REST API 요청 수신, JSON → Command 변환, UseCase 호출, Result → JSON 변환 | `AuthController`, `InterviewController`          |
| Input Adapter  | Kafka Consumer         | `~EventConsumer`      | Kafka 메시지 구독, Event → Command 변환, UseCase 호출                     | `InterviewEventConsumer`                         |
| Output Adapter | Persistence Impl       | `~PersistenceAdapter` | Output Port 구현, Domain Entity ↔ JPA Entity 변환, DB CRUD 수행           | `UserPersistenceAdapter`                         |
| Output Adapter | Cache Impl             | `~CacheAdapter`       | Output Port 구현, Redis/Memcached 등 캐시 저장/조회                       | `UserCacheAdapter`                               |
| Output Adapter | External API Impl      | `~Adapter`            | Output Port 구현, 외부 API 호출 (메일 발송, 결제 게이트웨이 등)           | `EmailServerAdapter`, `PaymentGatewayAdapter`    |
| Output Adapter | Kafka Producer         | `~ProducerAdapter`    | Output Port 구현, Kafka 메시지 발행 (Event Publishing)                    | `KafkaProducerAdapter`                           |
| JPA Entity     | Database Entity        | `~JpaEntity`          | DB 테이블 매핑 전용, @Entity 보유, 비즈니스 로직 없음 (데이터 홀더)       | `UserJpaEntity`, `InterviewJpaEntity`            |
| JPA Repository | Spring Data Repository | `Jpa~Repository`      | Spring Data JPA 인터페이스, CRUD 메서드 제공 (findById, save 등)          | `JpaUserRepository`, `JpaInterviewRepository`    |
| Mapper         | Entity Mapper          | `~Mapper`             | Domain Entity ↔ JPA Entity 양방향 변환 책임                               | `UserMapper`, `InterviewMapper`                  |

**핵심 규칙:**

- **Domain Entity는 순수 자바 객체**입니다. JPA `@Entity` 애노테이션을 사용하지 않습니다.
- **JPA Entity는 `adapter/out/persistence/entity/` 패키지**에 `~JpaEntity` 접미사로 생성합니다.
- **UseCase 구현체는 Interactor** 접미사를 사용합니다. (`~Service` 아님)
- **Adapter는 역할별 접미사**를 사용합니다 (`PersistenceAdapter`, `CacheAdapter`, `GrpcController` 등)
- **Command/Result는 application/dto** 패키지에 위치합니다.

### 3.1.1 gRPC Client Guidelines (Java)

**조회 메서드 (Lookup Methods):**

- `loadBy...`, `findBy...`, `get...` 등 데이터를 조회하는 메서드 구현 시, **반드시 `GrpcClientUtils.callToOptional`을 사용**해야 합니다.
- gRPC 서버는 데이터가 없을 때 `NOT_FOUND` 또는 `INVALID_ARGUMENT` 에러를 던지는데, 이를 클라이언트에서 `try-catch`로 매번 잡는 것은 실수하기 쉽고 코드가 지저분해집니다.
- **Bad Practice ❌**:
  ```java
  public Optional<User> loadByEmail(String email) {
      try {
          return Optional.of(stub.findByEmail(...));
      } catch (StatusRuntimeException e) {
          if (e.getStatus().getCode() == Status.NOT_FOUND) return Optional.empty(); // 매번 작성 번거러움
          throw e;
      }
  }
  ```
- **Good Practice ✅**:
  ```java
  public Optional<User> loadByEmail(String email) {
      return GrpcClientUtils.callToOptional(() ->
          stub.findByEmail(...)
      ).flatMap(this::mapUser);
  }
  ```

### 3.2 TypeScript (BFF Service)

| Component  | Pattern           | Example                    |
| ---------- | ----------------- | -------------------------- |
| Controller | `~.controller.ts` | `auth.controller.ts`       |
| Service    | `~.service.ts`    | `auth.service.ts`          |
| Module     | `~.module.ts`     | `auth.module.ts`           |
| DTO        | `~.dto.ts`        | `register.dto.ts`          |
| Guard      | `~.guard.ts`      | `jwt-auth.guard.ts`        |
| Strategy   | `~.strategy.ts`   | `jwt.strategy.ts`          |
| Client     | `~.client.ts`     | `grpc-core-auth.client.ts` |

---

### 3.3 Socket Event Naming (Socket Service)

**`domain:action`** 패턴을 사용합니다.

| 이벤트 방향           | 패턴               | 예시                    | 설명                                 |
| --------------------- | ------------------ | ----------------------- | ------------------------------------ |
| Client → Server       | `domain:action`    | `interview:audio_chunk` | 인터뷰 도중 오디오 청크 전송         |
| Server → Client       | `domain:action`    | `interview:stt_result`  | STT 변환 결과 수신                   |
| Server → Client (Ack) | `domain:ack_type`  | `interview:audio_ack`   | 오디오 수신 확인 (Ack)               |
| Connection Error      | `connection:error` | `connection:error`      | 연결 수립 단계 또는 전역 에러        |
| Domain Error          | `domain:error`     | `interview:error`       | 특정 도메인 로직 처리 중 발생한 에러 |

**주요 이벤트 목록:**

- **Connection:**
  - `socket.connected`: 서버 내부 이벤트 (연결 성공)
  - `socket.disconnected`: 서버 내부 이벤트 (연결 종료)
  - `connection:error`: 연결 관련 에러 (중복 세션 ID 등)

- **Interview (STT):**
  - `interview:audio_chunk`: 클라이언트가 오디오 데이터 전송
  - `interview:audio_ack`: 서버가 오디오 수신 확인
  - `interview:stt_result`: STT 텍스트 변환 결과 전송
  - `interview:error`: 인터뷰 로직 에러 (오디오 처리 실패 등)

## 4. 🔄 Data Flow Patterns

### 4.0 실시간 면접 플로우 (Real-Time Interview Flow)

**전체 E2E 흐름:**

```
[Phase 1: 사용자 음성 입력]
Client → Socket.IO: interview:audio_chunk (PCM16, 16kHz)
  ├─ Fast Path: Socket → gRPC Stream → STT (실시간 변환)
  └─ Safe Path: Socket → Redis Queue → Storage → Object Storage (안전 저장)

[Phase 2: STT 변환]
STT → Redis Pub/Sub/Streams: stt:transcript:pubsub
Socket 구독 → Client: interview:stt_result (실시간 자막)

[Phase 3: LLM 응답 생성]
STT → Kafka: UserAnswer 이벤트
Core → LLM: gRPC Streaming 요청
LLM → Core: 토큰 단위 스트리밍 (THINKING + CONTENT)
Core → Redis:
  ├─ Cache (APPEND): 네트워크 끊김 대비 백업
  ├─ Pub/Sub: 실시간 자막 (interview:transcript:{id})
  └─ Queue: TTS용 문장 단위 (tts:sentence:queue)

[Phase 4: TTS 생성]
Core → Kafka: BotQuestion 이벤트 (문장 단위)
TTS → Redis Pub/Sub: interview:audio:{interviewId}
Socket 구독 → Client: interview:ai_response_audio_chunk

[Phase 5: 최종 저장]
Core → PostgreSQL: 완료 시 최종 응답 저장
Storage → Object Storage: 원본 오디오 업로드
Storage → Kafka: storage.completed 이벤트
```

**핵심 전략:**

1. **Hybrid Dual-Write (입력)**:
   - Fast Path: 실시간성 우선 (gRPC Streaming)
   - Safe Path: 안전성 우선 (Redis Queue → Object Storage)
   - Client Retry: 최후의 보루 (ACK 대기)

2. **Streaming Pipeline (처리)**:
   - 토큰 단위 스트리밍으로 체감 지연 최소화
   - 문장 단위 버퍼링으로 조기 TTS 시작
   - Redis 다중 발행으로 안정성 확보

3. **이벤트 기반 출력**:
   - Kafka: 비동기 이벤트 (UserAnswer, BotQuestion)
   - Redis Pub/Sub: 실시간 전달 (자막, 오디오)
   - Redis Streams: 신뢰성 있는 메시지 처리

### 4.1 Request Flow (외부 → Domain → 외부)

```
Client (REST/gRPC)
  ↓
[Input Adapter] gRPC Controller (adapter/in/grpc)
  ↓ (Proto → Command 변환)
[Application] UseCase Interactor (application/interactor)
  ↓ (Command → Domain Entity)
[Domain] Domain Entity 비즈니스 로직 실행 (domain/entity)
  ↓
[Application] Output Port 호출 (application/port/out)
  ↓
[Output Adapter] Persistence Adapter (adapter/out/persistence/adapter)
  ↓ (Domain Entity → JPA Entity)
[Infrastructure] JPA Repository → Database (adapter/out/persistence/repository)
  ↓ (JPA Entity → Domain Entity)
[Application] Interactor → Result 반환
  ↓ (Result → Proto)
[Input Adapter] gRPC Controller → Client 응답
```

**계층별 데이터 변환:**

| 계층                 | 데이터 형태        | 예시                                    |
| -------------------- | ------------------ | --------------------------------------- |
| Client               | JSON/Proto         | `{"email": "user@test.com"}`            |
| Input Adapter        | Proto Message      | `SignupRequest`                         |
| Application          | Command DTO        | `RegisterUserCommand`                   |
| Domain               | Pure Domain Entity | `User` (순수 자바)                      |
| Output Port          | Domain Entity      | `User`                                  |
| Output Adapter       | JPA Entity         | `UserJpaEntity` (@Entity)               |
| Infrastructure       | DB Row             | `users` 테이블                          |
| Application (반환)   | Result DTO         | `AuthenticateUserResult`                |
| Input Adapter (반환) | Proto Message      | `SignupResponse`                        |
| Client (반환)        | JSON/Proto         | `{"userId": "uuid", "message": "성공"}` |

### 4.2 Authentication Flow (BFF ↔ Core)

```
1. Client → BFF: POST /api/v1/auth/login
2. BFF AuthController → AuthService.login()
3. BFF → Core gRPC: AuthService.ValidateUser(email, password)
4. Core AuthGrpcController → AuthenticateUserUseCase (Input Port)
5. Core AuthenticateUserInteractor:
   - LoadUserPort 호출 → UserPersistenceAdapter
   - JpaUserRepository → DB 조회
   - UserMapper: UserJpaEntity → User (Domain)
   - User.validatePassword() (Domain 로직)
   - Result 반환
6. Core → BFF: gRPC ValidateUserResponse
7. BFF → JWT Access Token 발급 + Refresh Token (Redis 저장)
8. BFF → Client: Access Token (Body) + Refresh Token (HttpOnly Cookie)
```

### 4.3 Event-Driven Flow (Kafka 메시징)

```
[면접 생성 요청]
Client → Core: CreateInterview
  ↓
Core InterviewGrpcController → CreateInterviewInteractor
  ↓
Domain Interview Entity 생성 + 비즈니스 검증
  ↓
SaveInterviewPort → InterviewPersistenceAdapter → DB 저장
  ↓
PublishEventPort → KafkaProducerAdapter
  ↓ [Event 발행]
Kafka Topic: "interview.created"

[비동기 후속 처리]
Kafka Topic: "interview.created"
  ↓
InterviewEventConsumer (Kafka Listener)
  ↓
SendInterviewEmailUseCase → EmailServerAdapter → 이메일 발송
```

### 4.4 Redis 패턴 (실시간 데이터 처리)

**Redis 용도별 구분:**

1. **Cache (백업)**:
   - Key: `interview:response:{interviewId}`
   - Command: `APPEND` (토큰 누적)
   - TTL: 네트워크 끊김 대비 임시 저장
   - 사용: LLM 스트리밍 데이터 백업

2. **Queue (안전 저장)**:
   - Key: `interview:audio:queue:{interviewId}`
   - Command: `LPUSH` (생산자), `BLPOP` (소비자)
   - 사용: 오디오 청크 큐잉 (Storage Worker가 소비)

3. **Pub/Sub (실시간 전달)**:
   - Channel: `stt:transcript:pubsub`, `interview:transcript:{id}`, `interview:audio:{id}`
   - 사용: 실시간 자막, TTS 오디오 전송
   - Consumer: Socket Service → WebSocket → Client

4. **Streams (신뢰성 있는 메시지)**:
   - Stream: `stt:transcript:stream`
   - Consumer Group: `stt:transcript:group`
   - 사용: STT transcript 신뢰성 있는 처리

**Redis 키 네이밍 규칙:**

- 계층 구조: `domain:resource:action:{id}`
- 예시:
  - `interview:audio:queue:{interviewId}` - 오디오 큐
  - `stt:transcript:pubsub` - STT Pub/Sub 채널
  - `interview:transcript:{interviewId}` - 실시간 자막
  - `interview:audio:{interviewId}` - TTS 오디오
  - `interview:response:{interviewId}` - LLM 응답 캐시

### 4.5 Kafka 패턴 (비동기 이벤트)

**토픽 구조:**

- `UserAnswer`: STT → Core (사용자 발화 텍스트)
- `BotQuestion`: Core → TTS (AI 응답 문장, 문장 단위)
- `storage.completed`: Storage → Core (파일 업로드 완료)

**파티션 키 필수:**

- **반드시 `sessionId` 또는 `interviewId`를 파티션 키로 지정**
- 이유: 같은 면접의 메시지가 순서대로 처리되어야 함 (문맥 보존)
- 예시: `kafka.producer.send({ key: interviewId, value: message })`

**이벤트 스키마:**

```json
// UserAnswer
{
  "eventType": "UserAnswer",
  "interviewId": 123,
  "userId": "user-uuid",
  "text": "저는 백엔드 개발자로 5년간 근무했습니다.",
  "timestamp": "2026-01-11T10:30:46.456Z"
}

// BotQuestion
{
  "eventType": "BotQuestion",
  "interviewId": 123,
  "sentence": "React Hooks는 어떤 상황에서 사용하셨나요?",
  "sentenceIndex": 0,
  "persona": "COMFORTABLE",
  "mode": "practice"
}
```

### 4.6 Domain Entity vs JPA Entity 분리 예시

**Domain Entity (순수 비즈니스 로직):**

```java
// domain/entity/User.java
package me.unbrdn.core.auth.domain.entity;

import java.util.UUID;
import java.time.LocalDateTime;

public class User {
    private UUID id;
    private String email;
    private String password;  // 암호화된 비밀번호
    private UserRole role;
    private UserStatus status;
    private LocalDateTime createdAt;

    // ✅ 순수 비즈니스 로직 (JPA 의존 없음)
    public boolean validatePassword(String rawPassword, PasswordEncoder encoder) {
        return encoder.matches(rawPassword, this.password);
    }

    public void activate() {
        if (this.status == UserStatus.DELETED) {
            throw new InvalidUserStateException("삭제된 사용자는 활성화할 수 없습니다");
        }
        this.status = UserStatus.ACTIVE;
    }

    // Getters, Builder, etc.
}
```

**JPA Entity (DB 매핑 전용):**

```java
// adapter/out/persistence/entity/UserJpaEntity.java
package me.unbrdn.core.auth.adapter.out.persistence.entity;

import jakarta.persistence.*;
import java.util.UUID;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class UserJpaEntity {
    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    private String role;

    @Enumerated(EnumType.STRING)
    private String status;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    // ❌ 비즈니스 로직 없음 (순수 데이터 홀더)
    // Getters, Setters only
}
```

**Mapper (변환 로직):**

```java
// adapter/out/persistence/mapper/UserMapper.java
package me.unbrdn.core.auth.adapter.out.persistence.mapper;

@Component
public class UserMapper {

    // Domain → JPA
    public UserJpaEntity toJpaEntity(User user) {
        UserJpaEntity entity = new UserJpaEntity();
        entity.setId(user.getId());
        entity.setEmail(user.getEmail());
        entity.setPassword(user.getPassword());
        entity.setRole(user.getRole().name());
        entity.setStatus(user.getStatus().name());
        entity.setCreatedAt(user.getCreatedAt());
        return entity;
    }

    // JPA → Domain
    public User toDomain(UserJpaEntity entity) {
        return User.builder()
            .id(entity.getId())
            .email(entity.getEmail())
            .password(entity.getPassword())
            .role(UserRole.valueOf(entity.getRole()))
            .status(UserStatus.valueOf(entity.getStatus()))
            .createdAt(entity.getCreatedAt())
            .build();
    }
}
```

---

## 5. 🛡️ Security Conventions

### 5.1 JWT Token Management

- **Access Token:** 15분 유효, Bearer Token으로 전송
- **Refresh Token:** 7일 유효, HttpOnly Cookie로 전송
- **Storage:** Refresh Token은 Redis에 저장 (`refresh_token:{userId}`)

### 5.2 Password Handling

- **Hashing:** BCrypt 사용 (Spring Security Crypto)
- **Storage:** 해시된 비밀번호만 DB에 저장
- **Validation:** Application Layer에서 수행

### 5.3 Gateway Offloading

- BFF에서만 JWT 검증 수행
- 내부 서비스(Core, Inference)는 `X-User-Id` 헤더를 신뢰
- Socket 연결 시에도 JWT 토큰 검증 필수

---

## 6. 📦 Dependency Management

### 6.1 Core Service (Java)

- **Spring Boot:** 4.0.1
- **Java:** 21
- **gRPC:** net.devh:grpc-server-spring-boot-starter
- **JPA:** Spring Data JPA
- **Password Encoding:** spring-security-crypto (BCrypt만)
- **Document Parsing:** Apache Tika

### 6.2 BFF Service (Node.js)

- **NestJS:** 11.x
- **gRPC:** @nestjs/microservices
- **JWT:** @nestjs/jwt, passport-jwt
- **Redis:** ioredis
- **Kafka:** kafkajs
- **Socket.io:** @nestjs/platform-socket.io

---

## 7. 🧪 Testing Conventions

### 7.1 Unit Tests (단위 테스트)

**Domain Layer 테스트:**

- **목적:** 순수 비즈니스 로직 검증
- **특징:** Mock 없음, 외부 의존성 없음
- **위치:** `src/test/java/{domain}/entity`

```java
// UserTest.java
class UserTest {

    @Test
    void 비밀번호_검증_성공() {
        // given
        User user = User.builder()
            .password("$2a$10$encoded...")
            .build();
        PasswordEncoder encoder = new BCryptPasswordEncoder();

        // when
        boolean result = user.validatePassword("rawPassword", encoder);

        // then
        assertThat(result).isTrue();
    }

    @Test
    void 삭제된_사용자는_활성화_불가() {
        // given
        User user = User.builder()
            .status(UserStatus.DELETED)
            .build();

        // when & then
        assertThatThrownBy(() -> user.activate())
            .isInstanceOf(InvalidUserStateException.class);
    }
}
```

**Application Layer 테스트 (UseCase 테스트):**

- **목적:** 비즈니스 흐름 검증
- **특징:** Output Port를 Mock으로 대체
- **위치:** `src/test/java/{domain}/application/interactor`

```java
// RegisterUserInteractorTest.java
@ExtendWith(MockitoExtension.class)
class RegisterUserInteractorTest {

    @Mock
    private LoadUserPort loadUserPort;

    @Mock
    private SaveUserPort saveUserPort;

    @InjectMocks
    private RegisterUserInteractor interactor;

    @Test
    void 회원가입_성공() {
        // given
        RegisterUserCommand command = new RegisterUserCommand("user@test.com", "password");
        when(loadUserPort.existsByEmail(command.email())).thenReturn(false);

        // when
        UUID userId = interactor.execute(command);

        // then
        assertThat(userId).isNotNull();
        verify(saveUserPort, times(1)).save(any(User.class));
    }
}
```

### 7.2 Integration Tests (통합 테스트)

**Persistence Adapter 테스트:**

- **목적:** DB 통합 검증
- **특징:** @DataJpaTest 사용, 실제 DB 또는 Testcontainers
- **위치:** `src/test/java/{domain}/adapter/out/persistence`

```java
// UserPersistenceAdapterTest.java
@DataJpaTest
class UserPersistenceAdapterTest {

    @Autowired
    private JpaUserRepository jpaRepository;

    private UserPersistenceAdapter adapter;
    private UserMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new UserMapper();
        adapter = new UserPersistenceAdapter(jpaRepository, mapper);
    }

    @Test
    void 사용자_저장_및_조회_성공() {
        // given
        User user = User.builder()
            .id(UUID.randomUUID())
            .email("test@test.com")
            .build();

        // when
        adapter.save(user);
        Optional<User> found = adapter.loadByEmail("test@test.com");

        // then
        assertThat(found).isPresent();
        assertThat(found.get().getEmail()).isEqualTo("test@test.com");
    }
}
```

**gRPC Controller 테스트:**

- **목적:** gRPC 통신 검증
- **특징:** UseCase를 Mock으로 대체
- **위치:** `src/test/java/{domain}/adapter/in/grpc`

```java
// AuthGrpcControllerTest.java
@ExtendWith(MockitoExtension.class)
class AuthGrpcControllerTest {

    @Mock
    private RegisterUserUseCase registerUserUseCase;

    @Mock
    private StreamObserver<SignupResponse> responseObserver;

    @InjectMocks
    private AuthGrpcController controller;

    @Test
    void 회원가입_gRPC_요청_성공() {
        // given
        SignupRequest request = SignupRequest.newBuilder()
            .setEmail("user@test.com")
            .setPassword("password")
            .build();
        UUID mockUserId = UUID.randomUUID();
        when(registerUserUseCase.execute(any())).thenReturn(mockUserId);

        // when
        controller.signup(request, responseObserver);

        // then
        verify(responseObserver, times(1)).onNext(any(SignupResponse.class));
        verify(responseObserver, times(1)).onCompleted();
    }
}
```

### 7.3 E2E Tests (종단 간 테스트)

**전체 흐름 테스트:**

- **목적:** 실제 환경과 유사한 테스트
- **특징:** Spring Boot 컨텍스트 전체 로드, Testcontainers 사용
- **위치:** `src/test/java/e2e`

```java
// AuthE2ETest.java
@SpringBootTest
@Testcontainers
class AuthE2ETest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @Autowired
    private AuthGrpcController authGrpcController;

    @Test
    void 회원가입_로그인_전체_플로우() {
        // 1. 회원가입
        SignupRequest signupRequest = SignupRequest.newBuilder()
            .setEmail("e2e@test.com")
            .setPassword("password123")
            .build();
        // ... 실행 및 검증

        // 2. 로그인
        ValidateUserRequest loginRequest = ValidateUserRequest.newBuilder()
            .setEmail("e2e@test.com")
            .setPassword("password123")
            .build();
        // ... 실행 및 검증
    }
}
```

### 7.4 Testing Best Practices

| 계층                         | 테스트 방법      | Mock 사용 여부      | 실제 DB 사용 여부        |
| ---------------------------- | ---------------- | ------------------- | ------------------------ |
| Domain Entity                | Unit Test        | ❌ 없음             | ❌ 없음                  |
| Application (Interactor)     | Unit Test        | ✅ Output Port Mock | ❌ 없음                  |
| Input Adapter (gRPC)         | Integration Test | ✅ UseCase Mock     | ❌ 없음                  |
| Output Adapter (Persistence) | Integration Test | ❌ 없음             | ✅ 있음 (Testcontainers) |
| E2E                          | End-to-End Test  | ❌ 없음             | ✅ 있음 (Testcontainers) |

---

## 8. 📝 Code Style

### 8.1 Java

- **Indentation:** 2 spaces
- **Line Length:** 120 characters
- **Naming:**
  - Classes: PascalCase
  - Methods/Variables: camelCase
  - Constants: UPPER_SNAKE_CASE

### 8.2 TypeScript

- **Indentation:** 2 spaces
- **Semicolons:** 사용
- **Quotes:** Single quotes
- **Trailing Commas:** 사용

---

## 9. 🔍 Error Handling

### 9.1 계층별 Exception 전략

**Domain Exception (domain/exception):**

- **역할:** 비즈니스 규칙 위반 시 발생
- **특징:** 체크 예외 또는 언체크 예외 (팀 컨벤션에 따름)
- **예시:**

```java
// domain/exception/DomainException.java
public class DomainException extends RuntimeException {
    public DomainException(String message) {
        super(message);
    }
}

// domain/exception/UserAlreadyExistsException.java
public class UserAlreadyExistsException extends DomainException {
    public UserAlreadyExistsException(String email) {
        super("이미 존재하는 이메일입니다: " + email);
    }
}

// domain/exception/InvalidPasswordException.java
public class InvalidPasswordException extends DomainException {
    public InvalidPasswordException() {
        super("비밀번호가 유효하지 않습니다");
    }
}
```

**Application Exception (application/exception):**

- **역할:** 유스케이스 실행 중 발생하는 예외
- **특징:** Domain Exception을 래핑하거나 새로운 예외 정의
- **예시:**

```java
// application/exception/UseCaseException.java
public class UseCaseException extends RuntimeException {
    private final String errorCode;

    public UseCaseException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }
}

// application/exception/AuthenticationException.java
public class AuthenticationException extends UseCaseException {
    public AuthenticationException(String message) {
        super("AUTH_001", message);
    }
}
```

**Adapter Exception (adapter/in/grpc/exception):**

- **역할:** 프로토콜별 에러 변환
- **특징:** Domain/Application 예외를 HTTP/gRPC 에러로 변환
- **예시:**

```java
// adapter/in/grpc/exception/GlobalGrpcExceptionHandler.java
@Component
public class GlobalGrpcExceptionHandler {

    public static Status toGrpcStatus(Exception e) {
        return switch (e) {
            case UserAlreadyExistsException ex ->
                Status.ALREADY_EXISTS.withDescription(ex.getMessage());
            case InvalidPasswordException ex ->
                Status.UNAUTHENTICATED.withDescription(ex.getMessage());
            case AuthenticationException ex ->
                Status.UNAUTHENTICATED.withDescription(ex.getMessage());
            case DomainException ex ->
                Status.INVALID_ARGUMENT.withDescription(ex.getMessage());
            default ->
                Status.INTERNAL.withDescription("서버 오류가 발생했습니다");
        };
    }
}
```

### 9.2 gRPC Error Mapping

**성공 응답:**

```java
// adapter/in/grpc/AuthGrpcController.java
@Override
public void signup(SignupRequest request, StreamObserver<SignupResponse> responseObserver) {
    try {
        UUID userId = registerUserUseCase.execute(command);

        SignupResponse response = SignupResponse.newBuilder()
            .setUserId(userId.toString())
            .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    } catch (Exception e) {
        handleException(e, responseObserver);
    }
}
```

**에러 응답:**

```java
private void handleException(Exception e, StreamObserver<?> responseObserver) {
    Status status = GlobalGrpcExceptionHandler.toGrpcStatus(e);
    responseObserver.onError(status.asRuntimeException());
}
```

**gRPC Status Code 매핑:**

| Domain Exception             | gRPC Status Code    | HTTP 유사 코드            |
| ---------------------------- | ------------------- | ------------------------- |
| UserAlreadyExistsException   | ALREADY_EXISTS      | 409 Conflict              |
| InvalidPasswordException     | UNAUTHENTICATED     | 401 Unauthorized          |
| UserNotFoundException        | NOT_FOUND           | 404 Not Found             |
| InsufficientBalanceException | FAILED_PRECONDITION | 412 Precondition Failed   |
| DomainException (기타)       | INVALID_ARGUMENT    | 400 Bad Request           |
| 예상치 못한 에러             | INTERNAL            | 500 Internal Server Error |

### 9.3 HTTP Error Mapping (BFF 서비스)

```java
// adapter/in/http/exception/GlobalExceptionHandler.java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(UserAlreadyExistsException.class)
    public ResponseEntity<ErrorResponse> handleUserAlreadyExists(UserAlreadyExistsException e) {
        ErrorResponse error = new ErrorResponse(
            "USER_ALREADY_EXISTS",
            e.getMessage(),
            LocalDateTime.now()
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(error);
    }

    @ExceptionHandler(InvalidPasswordException.class)
    public ResponseEntity<ErrorResponse> handleInvalidPassword(InvalidPasswordException e) {
        ErrorResponse error = new ErrorResponse(
            "INVALID_PASSWORD",
            e.getMessage(),
            LocalDateTime.now()
        );
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(Exception e) {
        ErrorResponse error = new ErrorResponse(
            "INTERNAL_SERVER_ERROR",
            "서버 오류가 발생했습니다",
            LocalDateTime.now()
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
    }
}
```

### 9.4 Error Response 구조

```java
// adapter/in/http/dto/response/ErrorResponse.java
public record ErrorResponse(
    String errorCode,
    String message,
    LocalDateTime timestamp
) {
    // JSON 응답 예시:
    // {
    //   "errorCode": "USER_ALREADY_EXISTS",
    //   "message": "이미 존재하는 이메일입니다: user@test.com",
    //   "timestamp": "2026-01-15T10:30:00"
    // }
}
```

---

## 10. 📚 Documentation

### 10.1 Code Comments

- **JavaDoc:** Public 메서드에 필수
- **주석:** 복잡한 비즈니스 로직에만 사용
- **TODO:** 구현 예정 기능에만 사용

### 10.2 API Documentation

- **REST API:** Swagger/OpenAPI 사용 (추후 추가)
- **gRPC:** Proto 파일이 문서 역할

---

## 11. 🚀 Deployment Conventions

### 11.1 Environment Variables

- **Core Service:** `SPRING_DATASOURCE_URL`, `CORE_GRPC_PORT`
- **BFF Service:** `CORE_GRPC_URL`, `JWT_SECRET`, `REDIS_HOST`
- **Inference Service:** `OPENAI_API_KEY`, `KAFKA_BROKER`

### 11.2 Configuration Files

- **Properties:** `application.properties`, `application.{profile}.properties`
- **Kubernetes:** `k8s/apps/{service}/deployment-{env}.yaml`

---

## 12. 🎙️ 실시간 음성 처리 패턴

### 12.1 오디오 처리 파이프라인

**프론트엔드 → Socket 서버:**

1. **마이크 캡처**: getUserMedia (44100Hz, 16-bit)
2. **리샘플링**: 44100Hz → 16000Hz (선형 보간)
3. **정규화**: Float32 → Int16 PCM16 변환
4. **전송**: Socket.IO `interview:audio_chunk` 이벤트 (500ms 간격)

**Socket → STT (Fast Path):**

- gRPC Streaming: `SttService.SpeechToText`
- Persistent stream: 인터뷰 세션당 단일 스트림 유지
- Keep-Alive: 10초마다 핑, 침묵 시에도 유지

**STT 처리:**

- VAD (Voice Activity Detection): 침묵 1.5초 감지 시 자동 종료
- 모드별 엔진:
  - `practice`: Faster-Whisper (로컬, 무료)
  - `real`: OpenAI Whisper API (유료, 정확)
- 결과 발행: Redis Pub/Sub + Streams

### 12.2 LLM 토큰 스트리밍

**Core → LLM (gRPC Streaming):**

- 요청: `GenerateRequest` (interviewId, userText, persona, history)
- 응답: `TokenChunk` 스트림 (token, is_sentence_end, thinking, is_final)

**Core의 지능형 버퍼링:**

- 토큰 누적 → 문장 부호(. ? !) 감지 → 즉시 Kafka 발행
- 결과: LLM이 뒷내용 생성하는 동안 사용자는 앞 문장 TTS를 듣게 됨
- 체감 대기 시간 < 1초 달성

**Redis 다중 발행:**

1. **Cache (APPEND)**: `interview:response:{interviewId}` - 네트워크 끊김 대비
2. **Pub/Sub**: `interview:transcript:{interviewId}` - 실시간 자막
3. **Queue**: `tts:sentence:queue` - TTS용 문장 단위

### 12.3 TTS 생성 및 전달

**TTS Worker 처리:**

- Input: Kafka `BotQuestion` 이벤트 (문장 단위)
- Processing: 모드별 엔진
  - `practice`: Edge-TTS (무료, 로컬)
  - `real`: OpenAI TTS API (유료)
- Output: Redis Pub/Sub `interview:audio:{interviewId}`

**Socket → Client:**

- Socket Service가 Redis Pub/Sub 구독
- Base64 인코딩된 오디오를 Socket.IO로 전송
- Client에서 디코딩 후 Audio 객체로 재생

### 12.4 자연 대화 모드

**상태 머신:**

```
IDLE → LISTENING → PROCESSING → SPEAKING → LISTENING (반복)
```

**VAD (Voice Activity Detection):**

- 프론트엔드: 1.5초 침묵 감지 → 자동 전송
- 서버: 0.5초 발화 + 1.5초 침묵 → 자동 종료
- 양방향 VAD로 자연스러운 대화 흐름 구현

**자동 재녹음:**

- TTS 재생 완료 (`onended` 이벤트) → 자동 녹음 재시작
- 버튼 없이 자연스러운 대화 가능

---

## 13. 📡 Proto File Management Guide

### 12.1 Proto 파일 위치 및 관리 원칙

**중앙 집중식 관리:**

모든 Proto 파일은 `services/proto/` 에서 관리되며, 각 서비스는 이를 참조합니다.

```
services/proto/
├── auth.proto                # Auth UseCase (Signup, ValidateUser)
├── interview.proto           # Interview UseCase (CreateInterview)
├── resume.proto              # Resume UseCase (UploadResume)
├── llm.proto                 # LLM Service (GenerateResponse, TextToSpeech)
├── stt.proto                 # STT (SpeechToText)
└── inference.proto           # Inference Service (TextToSpeech - GPU)
```

### 12.2 각 언어별 Proto 컴파일 및 참조 방식

**Java (Core/Auth/Interview/Resume MSA):**

```gradle
// build.gradle
protobuf {
    protoc {
        artifact = "com.google.protobuf:protoc:3.24.0"
    }
    plugins {
        grpc {
            artifact = "io.grpc:protoc-gen-grpc-java:1.58.0"
        }
    }
    generateProtoTasks {
        all().configureEach { task ->
            task.builtins {
                java {}
            }
            task.plugins {
                grpc {}
            }
        }
    }
}

// ✅ Proto 파일 위치를 services/proto로 지정
sourceSets {
    main {
        proto {
            srcDir '../proto'  // 상위 services/proto 참조
        }
    }
}
```

**Node.js (BFF/Socket):**

```typescript
// app.module.ts 또는 *.module.ts
import { join } from "path";

ClientsModule.register([
  {
    name: "AUTH_PACKAGE",
    transport: Transport.GRPC,
    options: {
      package: "auth",
      protoPath: join(__dirname, "../../proto/auth.proto"), // ✅ 상위 proto 폴더 참조
      url: "core:9090",
    },
  },
]);
```

**@grpc/proto-loader를 사용하므로 런타임에 자동 로드됨 (별도 컴파일 불필요)**

**Python (LLM/STT):**

```bash
# services/llm 또는 services/stt에서 실행
python -m grpc_tools.protoc \
  -I../proto \
  --python_out=. \
  --grpc_python_out=. \
  ../proto/llm.proto

# STT (stt)
python -m grpc_tools.protoc \
  -I../proto \
  --python_out=. \
  --grpc_python_out=. \
  ../proto/stt.proto
```

**생성된 파일을 import:**

```python
# grpc_server.py
import llm_pb2
import llm_pb2_grpc

# 또는
import stt_pb2
import stt_pb2_grpc
```

### 12.3 Proto 수정 후 처리 프로세스

**Proto 파일 수정:**

```protobuf
// services/proto/auth.proto
syntax = "proto3";

package auth;

option java_package = "me.unbrdn.auth.grpc";
option java_outer_classname = "AuthProto";

service AuthService {
  rpc NewMethod (NewRequest) returns (NewResponse);
}
```

**각 서비스에서 재컴파일:**

```bash
# Core/Auth MSA (Java)
cd services/auth && ./gradlew clean build

# BFF (Node.js) - 런타임 로드이면 불필요, 그 외:
cd services/bff && npm run proto:compile

# LLM (Python)
cd services/llm && python setup.py build

# STT Worker (Python)
cd services/stt && python setup.py build
```

### 12.4 MSA 분리 시 Proto 참조 방식

**모놀리식 상태 (현재):**

```
services/core/build.gradle
├── sourceSets.main.proto.srcDir = '../proto'  ← 상위 폴더 참조
```

**MSA 분리 후:**

```
services/auth/build.gradle
├── sourceSets.main.proto.srcDir = '../proto'  ← 여전히 중앙 proto 참조

services/interview/build.gradle
├── sourceSets.main.proto.srcDir = '../proto'  ← 여전히 중앙 proto 참조

services/payment/build.gradle
├── sourceSets.main.proto.srcDir = '../proto'  ← 여전히 중앙 proto 참조
```

**Docker Compose에서 Proto 공유:**

```yaml
# docker-compose.yml
version: "3.8"
services:
  auth:
    build:
      context: .
      dockerfile: services/auth/Dockerfile
    volumes:
      - ./services/proto:/app/proto:ro # 읽기 전용으로 Proto 공유

  interview:
    build:
      context: .
      dockerfile: services/interview/Dockerfile
    volumes:
      - ./services/proto:/app/proto:ro
```

---

## 14. ✅ Checklist for New Features

새로운 기능을 추가할 때 다음 체크리스트를 확인하세요:

**아키텍처 준수:**

- [ ] Hexagonal Architecture 패턴 준수 (Domain → Application → Adapter)
- [ ] **도메인 계층에 외부 의존성 없음** (JPA, Spring 등 의존 금지)
- [ ] UseCase는 **Interactor로 명명** (`~Service` 아님)
- [ ] Adapter는 **역할별 접미사** 사용 (`PersistenceAdapter`, `GrpcController` 등)

**도메인 설계:**

- [ ] **Domain Entity는 순수 자바 객체**로 작성 (JPA `@Entity` 사용 금지)
- [ ] **비즈니스 로직은 Domain Entity**에 위치
- [ ] Domain Exception은 `domain/exception` 패키지에 정의

**데이터 흐름:**

- [ ] **JPA Entity는 `adapter/out/persistence/entity/`** 패키지에 `~JpaEntity` 접미사로 작성
- [ ] **Mapper 클래스로 Domain Entity ↔ JPA Entity 변환**
- [ ] Command/Result DTO는 `application/dto` 패키지에 위치

**Port 정의:**

- [ ] Input Port는 `application/port/in/~UseCase.java` 인터페이스로 정의
- [ ] Output Port는 `application/port/out/~Port.java` 인터페이스로 정의
- [ ] Interactor는 Input Port를 구현하고 Output Port를 호출

**Adapter 구현:**

- [ ] Input Adapter (gRPC/HTTP)는 `adapter/in/` 패키지에 위치
- [ ] Output Adapter (Persistence/Cache/External)는 `adapter/out/` 패키지에 위치
- [ ] **PersistenceAdapter는 Output Port 구현** (LoadUserPort, SaveUserPort 등)

**보안:**

- [ ] JWT 인증이 필요한 경우 Guard 적용
- [ ] 비밀번호는 BCrypt로 해싱
- [ ] Refresh Token은 HttpOnly Cookie 사용

**gRPC 통신:**

- [ ] **gRPC 통신 시 `services/proto/`에 Proto 파일 정의**
- [ ] Proto 수정 후 모든 서비스 재컴파일 확인
- [ ] gRPC Controller에서 GlobalGrpcExceptionHandler 사용

**메시징 (Kafka):**

- [ ] Event 발행 시 PublishEventPort 사용
- [ ] Event 구독 시 `adapter/in/messaging/~EventConsumer.java` 작성
- [ ] Event DTO는 `adapter/out/messaging/dto/` 패키지에 위치

**테스트:**

- [ ] Domain Entity 단위 테스트 작성 (Mock 없음)
- [ ] Interactor 단위 테스트 작성 (Output Port Mock)
- [ ] PersistenceAdapter 통합 테스트 작성 (실제 DB 또는 Testcontainers)
- [ ] gRPC Controller 통합 테스트 작성 (UseCase Mock)

**에러 처리:**

- [ ] 적절한 Domain/Application Exception 정의
- [ ] GlobalGrpcExceptionHandler에 예외 매핑 추가
- [ ] 에러 응답 구조 일관성 유지

---

## 참고 문서

- [Architecture Document](./architecture.md): 전체 아키텍처 설계
- [Setup Guide](./setup-guide.md): 개발 환경 설정
- [Deployment Guide](./deployment-guide.md): 배포 가이드
