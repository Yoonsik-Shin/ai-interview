# Design Decisions

## 1. 도메인 엔티티 순수 POJO 원칙 (2026-02-15)

### 배경

Core 서비스의 도메인 엔티티가 JPA 어노테이션(`@Entity`, `@Table` 등)을 직접 가지고 있어, 도메인 레이어가 특정 영속성 기술(JPA/Hibernate)에 강하게 결합되어 있었습니다. 이는 클린 아키텍처의 핵심 원칙인 "도메인은 외부 기술에 독립적이어야 한다"는 원칙을 위반하며, 테스트 및 기술 변경을 어렵게 만들었습니다.

### 결정 사항

- **Domain Entity vs Persistence Entity 분리**: 모든 도메인 엔티티에서 JPA 의존성을 제거하고 순수 자바 객체(POJO)로 변환합니다.
- **Persistence Layer 도입**: 실제 DB와의 매핑은 `adapter/out/persistence/entity/` 패키지의 `~JpaEntity` 클래스가 담당하도록 합니다.
- **Mapping Strategy**: `PersistenceAdapter`에서 도메인 엔티티와 JPA 엔티티 간의 변환을 책임집니다.

### 기대 효과

- **아키텍처 정합성**: 도메인 로직이 데이터베이스 기술로부터 완전히 격리됩니다.
- **테스트 용이성**: Spring/JPA Context 없이도 순수 단위 테스트가 가능해집니다.
- **유연성**: 추후 영속성 기술(NoSQL 등)로의 전환이 용이해집니다.

---

## 2. LLM 서비스 아키텍처: Push vs Pull (2026-02-18)

### 배경

LLM 서비스가 동작하기 위해 필요한 면접 세션 정보, 대화 이력, 레쥬메 임베딩 등의 데이터를 어떻게 조달할 것인가에 대한 논의가 있었습니다.

- **현재 (Push 방식)**: Core 서비스가 모든 데이터를 조회/조합하여 LLM 호출 시 인자로 전달.
- **대안 (Pull 방식)**: Core는 최소한의 ID만 전달하고, LLM이 필요한 API를 병렬 호출하여 데이터 수집.

### 결정 사항

**현재 단계에서는 "Push 방식 (Core 주도)"을 유지합니다.**

- **이유 1: 순환 참조 방지**: 현재 모든 데이터(Session, History)의 소유권이 Core에 있습니다. LLM이 데이터를 조회하려면 Core API를 호출해야 하므로 `Core -> LLM -> Core` 라는 순환 의존성이 발생합니다.
- **이유 2: Latency 민감성**: 실시간 음성 면접 특성상, 1회의 왕복 호출(Core->LLM)이 N회의 왕복 호출(LLM->Core/DB/Vector)보다 응답 속도 면에서 유리합니다.
- **이유 3: 구현 복잡도**: 당장의 문제(시간 동기화) 해결에 집중하기 위해 아키텍처 대공사를 지양합니다.

### 향후 고려 사항 (To-Be)

서비스가 고도화되어 **"데이터 레이어 (Session Service, History Service)"가 별도로 분리된다면**, 그때는 **Pull 방식 (Agentic Workflow)**으로 전환하는 것이 타당합니다.

- LLM이 필요한 정보만 능동적으로 조회 (Lazy Loading)
- 병렬 처리를 통한 데이터 수집 최적화
- Core와 LLM의 결합도 감소

## 5. SELF_INTRO 전환 시 낙관적 락 적용 (2026-02-26)

### 문제

Socket의 90초 타이머와 Core의 `ProcessUserAnswerInteractor`가 동시에 `SELF_INTRO → IN_PROGRESS` 전환을 시도하면, 이중 `STAGE_CHANGE` 이벤트/LLM 호출이 발생할 수 있음.

### 선택: JPA `@Version` 낙관적 락

- **근거**: 외부 인프라(Redis 락) 없이 DB 레벨에서 동시성 제어 가능. 충돌 빈도가 매우 낮으므로 낙관적 전략이 적합.
- **구현**: `InterviewSessionJpaEntity`에 `@Version Long version` 추가. 두 Interactor에서 `save()` 시 `ObjectOptimisticLockingFailureException` catch → 중복 전환 무시.
- **대안 기각**: Redis `SETNX` 분산 락 — 추가 인프라 의존, 이 케이스에선 과한 접근.

## 6. RETRY_ANSWER 이벤트 전달 경로: Redis Pub/Sub 단일화 (2026-02-26)

### 문제

자기소개 30초 미만 재시도 로직이 동작하지 않았음. 원인 분석 결과 두 가지 문제 발견:

1. **Room 이름 불일치**: 클라이언트는 `interview-session-${id}` room에 join하지만, `SendTranscriptUseCase`는 `interview:${id}` room으로 emit하고 있어 모든 Redis Pub/Sub 경유 이벤트(STAGE_CHANGE, RETRY_ANSWER)가 전달 불가.
2. **이벤트 타입 불일치**: Core에서 Kafka로 `RETRY_ANSWER` 타입, Redis Pub/Sub로 `SELF_INTRO_RETRY` 타입을 각각 발행. Socket은 Kafka를 소비하지 않고, `SendTranscriptUseCase`는 `RETRY_ANSWER`만 체크하므로 어느 경로로도 이벤트가 처리되지 않음.

### 선택: Redis Pub/Sub 단일 경로 + Room 이름 통일

- **Room 이름**: `SendTranscriptUseCase`의 room을 `interview-session-${id}`로 수정하여 connection listener와 통일.
- **이벤트 경로**: Kafka 발행 제거, Redis Pub/Sub에서 `RETRY_ANSWER` 타입으로 발행하여 `SendTranscriptUseCase`에서 올바르게 핸들링.
- **근거**: Socket 서비스는 Kafka consumer가 없으므로 Redis Pub/Sub가 유일한 실시간 이벤트 전달 경로. 경로를 단일화하여 복잡도 감소.

---

## 7. 데이터베이스 연결 URL과 스키마 자동 생성 충돌 방지 (2026-03-24)

### 배경
`resume` 서비스 배포 시 `org.postgresql.util.PSQLException: ERROR: schema "resume" does not exist` 에러와 함께 `CrashLoopBackOff` 현상이 발생했습니다. 
Application 설정(`deployment.yaml`)에 `SPRING_FLYWAY_CREATE_SCHEMAS: "true"`가 설정되어 있음에도 Flyway 가 작동하지 못했습니다.

### 원인 분석 (닭이 먼저냐 달걀이 먼저냐)
1. **JDBC URL 설정**: `SPRING_DATASOURCE_URL`에 `?currentSchema=resume,public`이 포함되어 있었습니다.
2. **연결 실패**: PostgreSQL 드라이버는 연결 수립 시 해당 스키마로 `search_path`를 설정하려 합니다. 하지만 스키마가 존재하지 않으므로 드라이버 레벨에서 연결이 거부됩니다.
3. **Flyway 불발**: 데이터베이스 연결(HikariCP)이 성립되지 않아 Flyway가 스키마를 생성하는 로직을 실행하지 못했습니다.

### 결정 사항
- **JDBC URL 옵션 제거**: `k8s/apps/resume/local/deployment.yaml`의 `SPRING_DATASOURCE_URL`에서 `?currentSchema=resume,public` 옵션을 제거합니다.
- **JPA 기본 스키마 설정**: Hibernate가 쿼리 시 `resume` 스키마를 기본으로 사용할 수 있도록 `SPRING_JPA_PROPERTIES_HIBERNATE_DEFAULT_SCHEMA=resume` 환경 변수를 추가하여 대체합니다.

### 기대 효과
- 최초 배포 시에도 Flyway 가 정상적으로 데이터베이스에 연결하여 `resume` 스키마를 자동 생성하고 마이그레이션을 수행할 수 있게 됩니다.
