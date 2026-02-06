# Design Decisions

## 2026-02-05: Flyway Manual Configuration for Core Service

### Context

Core 서비스 기동 시 Flyway 마이그레이션이 실행되지 않아 Hibernate Validation (`validate` mode) 단계에서 컬럼 누락 에러로 앱이 죽는 현상 발생.

### Problems

1. `spring-boot-starter-data-jpa`와 `flyway-core`가 존재함에도 `FlywayAutoConfiguration`이 동작 로그를 남기지 않음.
2. Spring Boot 4.0.1 (Experimental/Custom version) 환경에서의 자동 설정 로직 변화 가능성.

### Decision

- **Flyway 수동 설정 클래스 (`FlywayConfig`) 도입**:
  - `Flyway` 빈을 직접 생성하고 `initMethod = "migrate"`를 지정하여 확실한 기동 보장.
  - `System.out.println`을 포함하여 로그 가시성 확보.
- **Hibernate ddl-auto**: 임시로 `none` 설정 후, Flyway 작동 확인 시 `validate`로 복원.

### Consequences

- **Pros**: 자동 설정의 블랙박스 문제를 우회하여 즉각적인 기동 성공 가능.
- **Cons**: 코드가 다소 늘어나며 Spring Boot의 "Convention over Configuration" 원칙에서 멀어짐. (추후 원인 파악 시 원복 예정)

---

## 2026-02-06: Resume Upload and Analysis Pipeline

### Context

사용자가 업로드한 이력서를 분석하여 면접의 컨텍스트로 활용해야 함. 대용량 파일 처리와 무거운 AI 분석 작업(텍스트/이미지 추출)을 효율적으로 처리할 아키텍처가 필요함.

### Decisions

1. **Presigned URL Upload (S3/MinIO)**:
   - 직접 업로드 방식을 채택하여 BFF/Core 서비스의 메모리 및 대역폭 사용을 최소화함.
2. **Kafka-based Asynchronous Processing**:
   - Core(Java) -> Document(Python) 간의 데이터 전송에 Kafka를 사용. 분석 작업의 긴 지연 시간(Latency)을 고려하여 결합도를 낮추고 재시도(Retry) 신뢰성을 확보함.
3. **Python for Document Service**:
   - PDF 파싱 및 AI 연산에 강점이 있는 Python 환경을 전용 서비스(`document`)로 분리하여 구현.
4. **Redis Pub/Sub & WebSocket Notification**:
   - 분석 완료 시 실시간으로 사용자에게 피드백을 주기 위해 Redis Pub/Sub과 Socket.IO를 조합한 알림 레이어를 구축함.

### Consequences (Resume Pipeline)

- **Pros**: 인프라 트래픽 분산, 서비스 간 독립성 확보, 실시간 사용자 경험 향상.
- **Cons**: Kafka, Redis 등 인프라 의존성이 추가되며 전체 시스템의 복잡도가 증가함.

---

## 2026-02-06: Decoupled Storage Access for Document Service

### Context

`document` 서비스가 이력서 분석을 위해 Object Storage(MinIO)에 직접 접근하면서 어드민 시크릿(`storage-secrets`)을 공유해야 하는 설계적 결함 발견. 이는 보안상 취약하고 서비스 간 결합도를 높임.

### Decisions

1.  **Presigned GET/PUT URL via Storage Service**:
    - `storage` 서비스에 업로드(`PUT`)와 다운로드(`GET`) Presigned URL 발급 기능을 통합하여 단일 창구화함.
2.  **Secret Isolation**:
    - `document` 서비스에서 직접적인 S3 연결 코드와 시크릿 의존성을 완전히 제거. 오직 URL과 `storage` 서비스 API만 사용하도록 격리함.
3.  **URL Pass-through via Kafka**:
    - `Core` 서비스가 분석 요청 이벤트를 발행할 때, 접근 권한이 부여된 다운로드 URL을 함께 실어 보냄으로써 `document` 서비스가 별도의 권한 없이 작업할 수 있게 함.

### Consequences (Storage Decoupling)

- **Pros**: `document` 서비스가 완벽하게 Stateless하고 시크릿에 독립적인(Worker) 구조로 진화. 보안성 및 유지보수성 대폭 향상.
- **Cons**: Kafka 메시지 크기가 다소 증가(URL 포함)하고, 스토리지 접근 시마다 Presigned URL 발급 절차를 거쳐야 함.
