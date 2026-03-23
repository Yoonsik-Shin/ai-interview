# Core Service Package Structure Guide

이 문서는 **Core Service**의 패키지 구조와 각 계층(Layer)의 역할을 정의합니다.
본 프로젝트는 **Hexagonal (Ports & Adapters)** 및 **Clean Architecture** 원칙을 따르며, 비즈니스 로직의 순수성을 유지하고 외부 기술(Framework, DB, UI 등)로부터의 독립성을 보장하는 것을 목표로 합니다.

## 🏗️ 전체 구조 (High-Level Overview)

```
me.unbrdn.core.{domain_name}
├── domain          # [Core] 순수 비즈니스 로직 (Java POJO)
├── application     # [Orchestration] 유스케이스 및 애플리케이션 로직
├── adapter         # [Infrastructure] 외부 통신 및 기술 구현체
├── config          # [Framework] 인프라 설정 (DB, Redis, Kafka 등)
└── common          # [Shared Kernel] 공통 유틸리티 및 헬퍼
```

---

## 1. Domain Layer (`domain`)

**"무엇을 하는가?" (Business Rules)**

- 가장 안쪽에 위치하며, 어떤 외부 의존성(Spring, JPA 등)도 가지지 않는 순수한 자바 영역입니다.
- 핵심 비즈니스 규칙과 상태를 포함합니다.

### 하위 패키지

- **`entity`**: 도메인 엔티티.
  - **규칙**: JPA 어노테이션(`@Entity`, `@Table`)을 **절대 사용하지 않습니다**.
  - **역할**: 비즈니스 행위와 상태를 캡슐화합니다.
- **`service`**: 도메인 서비스.
  - **역할**: 하나의 엔티티에 속하지 않는 도메인 로직이나, 여러 엔티티 간의 상호작용을 담당합니다.
- **`exception`**: 도메인 고유의 예외 정의.
- **`enum` / `vo`**: 상태 값(Enum)이나 값 객체(Value Object).

---

## 2. Application Layer (`application`)

**"어떻게 사용하는가?" (Use Cases)**

- 도메인 계층을 감싸며, 외부 요청을 처리하여 도메인 로직을 실행하는 오케스트레이션 역할을 합니다.
- 트랜잭션 관리(`@Transactional`)가 여기서 이루어집니다.

### 하위 패키지

- **`port.in`** (Input Port): 외부에서 애플리케이션을 사용하기 위한 인터페이스 (Use Case).
  - 예: `StartInterviewUseCase`, `RegisterUserUseCase`
- **`port.out`** (Output Port): 애플리케이션이 외부(DB, 타 서비스)를 사용하기 위한 인터페이스.
  - 예: `LoadUserPort`, `SaveInterviewPort`
- **`interactor`**: Input Port(Use Case)의 구현체.
  - **규칙**: 클래스 명은 `~Service` 대신 **`~Interactor`**를 사용합니다. (예: `StartInterviewInteractor`)
  - **역할**: 도메인 엔티티를 불러오고, 비즈니스 로직을 실행하고, 결과를 저장하거나 반환합니다.
- **`dto`**: 계층 간 데이터 전송 객체.
  - **역할**: API 요청/응답 스펙과 도메인 모델을 분리하기 위해 사용합니다. (Command, Result 등)

---

## 3. Adapter Layer (`adapter`)

**"누구와 통신하는가?" (Inputs & Outputs)**

- 애플리케이션과 외부 세계(Web, DB, 타 시스템)를 연결하는 어댑터입니다.

### 하위 패키지

- **`in`** (Inbound Adapter - Driving Adapter): 외부의 요청을 받아 애플리케이션 포트를 호출합니다.
  - **`web`**: Spring MVC RestController (BFF 서비스와의 통신).
  - **`grpc`**: gRPC Service Implementation (STT, LLM 등 타 마이크로서비스와의 통신).
  - **`consumer`**: Kafka Consumer, Redis Subscriber 등.
- **`out`** (Outbound Adapter - Driven Adapter): 애플리케이션의 요청을 받아 외부 시스템을 호출하거나 데이터를 저장합니다.
  - **`persistence`**: 영속성 어댑터 (DB 접근).
    - `entity`: **JPA Entity** (`@Entity`)가 위치하며, DB 테이블과 매핑됩니다.
    - `repository`: Spring Data JPA Repository 인터페이스.
    - `adapter`: Output Port(`port.out`)의 구현체. 도메인 엔티티와 JPA 엔티티 간의 변환(Mapper)을 담당합니다.
  - **`external`**: 외부 API 호출 클라이언트.
  - **`producer`**: Kafka Producer, Redis Publisher 등.

---

## 4. Configuration & Common Layer (`config`, `common`)

**"어떻게 설정하고, 무엇을 공유하는가?" (Infrastructure Support)**

### `config`

- 애플리케이션의 **모든 환경 설정(`@Configuration`)을 중앙 집중화**하여 관리합니다.
- **포함되는 것**: `JacksonConfig`, `RedisConfig`, `KafkaConfig`, `GrpcConfig`, `QueryDslConfig` 등.
- **규칙**: 비즈니스 로직은 `config` 패키지를 참조하지 않습니다.

### `common`

- 여러 도메인이나 레이어에서 공통적으로 사용하는 유틸리티, 헬퍼 클래스, 예외 처리 등을 모아둡니다.
- **포함되는 것**: `GlobalExceptionHandler`, `TimeUtils`, `BaseEntity` 등.
- **규칙**: `common` 패키지 내부에는 **설정(`@Configuration`) 클래스를 두지 않습니다**. (설정은 `config` 패키지로 이동)

---

## 🔄 의존성 규칙 (Dependency Rule)

**`Adapter` ➡️ `Application` ➡️ `Domain`**

1. **Domain**은 아무것도 의존하지 않습니다.
2. **Application**은 **Domain**만 의존합니다.
3. **Adapter**는 **Application**에 의존합니다. (단, `out` 어댑터는 `application.port.out` 인터페이스를 구현합니다.)
