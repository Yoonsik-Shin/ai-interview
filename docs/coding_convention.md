# 🏗️ AI Interview Solution - Project Convention & Architecture

본 문서는 OCI 프리티어 기반 하이브리드 AI 면접 솔루션 프로젝트의 개발 표준과 아키텍처 원칙을 정의합니다. 모든 기여자는 이 컨벤션을 준수해야 합니다.

---

## 1. 🏛️ Core Architecture Principles

우리는 **Clean Architecture (Hexagonal Architecture)** 와 **DDD (Domain-Driven Design)** 원칙을 따릅니다.

### 1.1 Gateway Offloading Pattern
* **BFF (Backend For Frontend)** 가 "문지기" 역할을 수행합니다.
* **Authentication:** BFF에서 JWT 검증 및 발급을 전담합니다.
* **Trust Zone:** 내부 마이크로서비스(Core, Inference)는 인증 로직을 수행하지 않고, 헤더로 전달된 `X-User-Id`를 신뢰합니다.
* **Communication:** 외부 통신은 `REST`, 내부 통신(BFF ↔ Core)은 `gRPC`를 사용합니다.

### 1.2 Separation of Concerns (관심사의 분리)
* **Domain:** 순수 비즈니스 로직. 프레임워크나 DB 기술에 의존하지 않습니다.
* **Application:** 유스케이스 흐름 제어 (What the system does).
* **Adapter:** 외부 세계(Web, DB, gRPC)와 내부를 연결하는 변환기.

---

## 2. 📂 Directory Structure & Packaging

**"패키지 구조가 아키텍처를 소리치게 하라(Screaming Architecture)"** 원칙에 따라, 기능의 의도가 명확히 드러나도록 구성합니다.

### 🏛️ Core Service (Java/Spring Boot)
**Package Root:** `com.example.core`

```
src/main/java/com/example/core
├── adapter                  # [Adapter Layer] 외부와의 통신 담당
│   ├── in
│   │   └── grpc             # gRPC Controller (Inbound)
│   └── out
│       └── persistence      # JPA Repository 구현체 (Outbound)
├── application              # [Application Layer] 유스케이스 처리
│   ├── port
│   │   ├── in               # UseCase Interface (Input Port)
│   │   └── out              # Repository Interface (Output Port)
│   ├── service              # UseCase Implementation (Interactor)
│   ├── exception            # Application Exception
│   └── service              # Command/Result DTO
└── domain                   # [Domain Layer] 핵심 비즈니스 로직
    ├── entity               # JPA Entity 겸 Domain Object
    ├── enums                # Domain Enum
    ├── repository           # Repository Interface (JPA)
    └── service              # 순수 도메인 로직 (필요 시)
```

**도메인별 패키지 구조 예시 (Auth 모듈):**
```
com.example.core.auth
├── domain
│   └── service              # PasswordEncoder 인터페이스
├── application
│   ├── port
│   │   ├── in               # RegisterUserUseCase, AuthenticateUserUseCase
│   │   └── out              # LoadUserPort, SaveUserPort
│   ├── service              # RegisterUserInteractor, AuthenticateUserInteractor
│   └── exception            # AuthenticationException, UserAlreadyExistsException
└── adapter
    ├── in
    │   └── grpc             # AuthGrpcController
    └── out
        └── persistence      # UserPersistenceAdapter, BcryptPasswordEncoder
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

| Layer | Component | Suffix / Pattern | Example |
|-------|-----------|------------------|---------|
| Input Port | UseCase Interface | `~UseCase` | `RegisterUserUseCase`, `AuthenticateUserUseCase` |
| Application | UseCase Implementation | `~Interactor` | `RegisterUserInteractor` (Not `UserService`) |
| Input Adapter | gRPC Controller | `~GrpcController` | `AuthGrpcController` |
| Output Port | Repository Interface | `~Port` | `LoadUserPort`, `SaveUserPort` |
| Output Adapter | Persistence Impl | `~PersistenceAdapter` | `UserPersistenceAdapter` |
| Domain | Domain Service | `~DomainService` | `UserDomainService` (순수 비즈니스 로직) |
| Command | Input DTO | `~Command` | `RegisterUserCommand` |
| Result | Output DTO | `~Result` | `AuthenticateUserResult` |

**규칙:**
- UseCase 구현체는 **Interactor** 접미사를 사용합니다. (`~Service` 아님)
- Adapter는 **PersistenceAdapter** 또는 **GrpcController** 접미사를 사용합니다.
- Command/Result는 Application Layer의 `service` 패키지에 위치합니다.

### 3.2 TypeScript (BFF Service)

| Component | Pattern | Example |
|-----------|---------|---------|
| Controller | `~.controller.ts` | `auth.controller.ts` |
| Service | `~.service.ts` | `auth.service.ts` |
| Module | `~.module.ts` | `auth.module.ts` |
| DTO | `~.dto.ts` | `register.dto.ts` |
| Guard | `~.guard.ts` | `jwt-auth.guard.ts` |
| Strategy | `~.strategy.ts` | `jwt.strategy.ts` |
| Client | `~.client.ts` | `grpc-core-auth.client.ts` |

---

## 4. 🔄 Data Flow Patterns

### 4.1 Request Flow (BFF → Core)

```
Client (REST)
  ↓
BFF Controller (REST)
  ↓
BFF Service (Application Logic)
  ↓
gRPC Client (Infrastructure Adapter)
  ↓
Core gRPC Controller (Input Adapter)
  ↓
UseCase (Application Layer)
  ↓
Persistence Adapter (Output Adapter)
  ↓
JPA Repository → Oracle DB
```

### 4.2 Authentication Flow

```
1. Client → POST /api/v1/auth/login
2. BFF AuthController → AuthService.login()
3. AuthService → GrpcCoreAuthClient.validateUser()
4. Core AuthGrpcController → AuthenticateUserUseCase
5. Core → DB 조회 및 비밀번호 검증
6. BFF → JWT Access Token 발급 + Refresh Token (Redis 저장)
7. Response → Access Token (Body) + Refresh Token (HttpOnly Cookie)
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

### 7.1 Unit Tests
- **Domain Layer:** 순수 비즈니스 로직 테스트 (Mock 없음)
- **Application Layer:** UseCase 테스트 (Port Mock)
- **Adapter Layer:** 통합 테스트 또는 E2E 테스트

### 7.2 Integration Tests
- gRPC 통신 테스트
- DB 통합 테스트
- Kafka 메시징 테스트

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

### 9.1 Application Exceptions
- **Domain Exception:** 도메인 규칙 위반 시
- **Application Exception:** 유스케이스 실패 시
- **Infrastructure Exception:** 외부 시스템 오류 시

### 9.2 gRPC Error Mapping
```java
// 성공
responseObserver.onNext(response);
responseObserver.onCompleted();

// 실패
responseObserver.onError(
    io.grpc.Status.INTERNAL
        .withDescription("오류 메시지")
        .asRuntimeException()
);
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

## 12. ✅ Checklist for New Features

새로운 기능을 추가할 때 다음 체크리스트를 확인하세요:

- [ ] Hexagonal Architecture 패턴 준수
- [ ] 도메인 계층에 외부 의존성 없음
- [ ] UseCase는 Interactor로 명명
- [ ] Adapter는 PersistenceAdapter 또는 GrpcController로 명명
- [ ] JWT 인증이 필요한 경우 Guard 적용
- [ ] gRPC 통신 시 Proto 파일 정의
- [ ] 에러 처리는 적절한 Exception 사용
- [ ] 비밀번호는 BCrypt로 해싱
- [ ] Refresh Token은 HttpOnly Cookie 사용

---

## 참고 문서

- [Architecture Document](./architecture.md): 전체 아키텍처 설계
- [Setup Guide](./setup-guide.md): 개발 환경 설정
- [Deployment Guide](./deployment-guide.md): 배포 가이드

