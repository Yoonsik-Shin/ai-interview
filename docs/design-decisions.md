# Design Decisions

## 2026-02-11: Resume Update Standardization (Option A - Presigned URL Flow)

### Context

기존 `updateResume` 로직은 BFF에서 직접 파일을 받아 gRPC(`bytes` 필드)로 Core 서비스에 전달하는 방식이었음. 이는 대용량 파일 처리 시 서비스 부하를 유발하며, 이미 구축된 Presigned URL 기반의 신규 업로드 프로세스와 이중화되어 유지보수 복잡도를 높임. 또한 기존 로직은 데이터베이스 레코드만 업데이트하고 실제 물리 파일을 교체하지 않는 결함이 있었음.

### Decisions

1.  **Unified Update via Presigned URL**:
    - 이력서 업데이트를 "신규 업로드 프로세스"와 동일하게 표준화함.
    - `GetUploadUrl` -> `S3/MinIO Direct Upload` -> `CompleteUpload` 순서를 따름.
2.  **Extended `CompleteUpload` Interface**:
    - `CompleteUploadRequest`에 `existingResumeId` 필드를 추가하여, 업로드 완료 시 이 ID가 제공되면 기존 데이터를 대체(Replace)하도록 함.
3.  **Legacy Code Removal**:
    - 직접 `bytes`를 전송하는 `UpdateResume` gRPC RPC 및 관련 인터페이스/구현체를 모두 삭제하여 아키텍처를 단일화함.
4.  **Automatic Cleanup**:
    - 업데이트 수행 시 Core 서비스에서 기존 물리 파일과 구식 벡터 임베딩을 자동으로 삭제하여 데이터 일관성을 유지함.

### Consequences

- **Pros**:
  - 서비스 메모리 및 대역폭 효율 최적화 (대용량 파일 직접 전송 방지).
  - 업로드/업데이트 로직의 단일화로 유지보수성 향상.
  - 실제 스토리지 파일 교체 및 데이터 정리 자동화.
- **Cons**:
  - 업데이트 시 프론트엔드에서 API 호출 횟수가 증가함 (3단계: URL 발급 -> 업로드 -> 완료).
  - 기존 레거시 API를 사용하는 클라이언트와의 하위 호환성 단절 (Breaking Change).

---

## 2026-02-11: BFF gRPC Module Refactoring & Centralized Configuration

### Context

BFF 서비스의 `GrpcModule`에서 여러 gRPC 클라이언트 설정이 중복되어 관리되고 있었으며, 환경 변수(`URL`, `HOST`, `PORT`) 처리 로직이 난잡하여 유지보수가 어려운 상태였음.

### Decisions

1.  **Global gRPC Configuration Unification (Separated Host/Port)**:
    - 모든 gRPC 연결 설정을 `${SERVICE}_GRPC_HOST`와 `${SERVICE}_GRPC_PORT`로 통일.
    - 기존의 `${SERVICE}_GRPC_URL` 형식은 제거하여 관리 포인트를 단일화함.
2.  **Centralized gRPC Configuration (`GrpcConfigService` - BFF)**:
    - BFF 서비스의 경우, 전용 서비스를 통해 설정을 중앙 집중 관리.
3.  **Cross-Service Application**:
    - BFF(Node.js), Socket(Node.js), Core(Java) 모든 서비스의 코드 및 K8s manifests(ConfigMap)에 일관되게 적용.
4.  **Schema-based Environment Validation**:
    - `env-validation.schema.ts` (BFF) 등에 반영하여 앱 기동 시 유효성 검사 강제.

### Consequences

- **Pros**: 전체 아키텍처 수준에서의 설정 정합성 확보, Redis 등 기존 Host/Port 분리형 패턴과의 일관성 유지.
- **Cons**: 기존 `*_URL` 환경 변수 사용 불가 (마이그레이션 필요).

---

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

---

## 2026-02-07: Hybrid Vector Search & Client-side PII Masking

### Context

이력서 업로드 시 중복 데이터를 방지하고 보안을 유지하면서 유효성을 검사해야 함. 로컬 개발 환경과 실제 운영 환경의 DB 인터페이스가 다르며, LLM 전송 시 개인정보 노출 위험이 있음.

### Decisions

1.  **Hybrid Vector Search Implementation**:
    - **Local**: `pgvector`를 사용하여 가벼운 벡터 연산 수행.
    - **Prod**: `Oracle AI Search (Vector Distance)`를 사용하여 대용량 데이터 환경에 최적화.
    - `SearchResumeByVectorPort` 인터페이스를 통해 인프라를 추상화함.
2.  **SHA-256 File Hashing**:
    - 벡터 검색 전, 완전히 동일한 파일에 한해 빠른 해시 비교(Exact Match)를 선행하여 연산 비용을 절감함.
3.  **Client-side PII Masking & Local Text Extraction**:
    - 서버 부하를 줄이고 LLM 전송 전 보안을 강화하기 위해 프론트엔드에서 직접 텍스트를 추출(`pdfjs-dist`, `mammoth`)하고 민감 정보(이메일, 전화번호 등)를 마스킹 처리함.
4.  **Similarity Threshold (0.95)**:
    - 95% 이상의 코사인 유사도를 가진 이력서를 동일 이력서로 간주하여 중복 업로드를 방지함.

### Consequences

- **Pros**: 인프라 종속성 해결, LLM API 비용 절감(중복 방지), 데이터 보안성 확보.
- **Cons**: 프론트엔드 번들 크기 증가(추출 라이브러리 포함), DB별 네이티브 쿼리 유지보수 필요.

---

## 2026-02-07: Client-side AI Inference & Backend Cleanup Logic

### Context

업로드 전 이력서 판별 속도를 높이고, 백엔드 검증 실패 시 이미 업로드된 물리 파일이 스토리지에 남는 문제를 해결해야 함.

### Decisions

1.  **Client-side AI (Transformers.js)**:
    - 브라우저 내에서 직접 `distilbert-base-uncased-mnli` 모델을 실행하여 이력서 여부를 즉시 판별.
2.  **Dual-Gate Architecture**:
    - 프론트엔드(로컬 AI)와 백엔드(해시/벡터/LLM)의 이중 검증 구조 채택.
3.  **Automated Storage Cleanup**:
    - 백엔드 검증(중복 감지 등) 실패 시, `DeleteFilePort`를 호출하여 스토리지에서 즉시 파일을 제거함.

### Consequences

- **Pros**: 사용자에게 0.5초 내 피드백 제공, 서버 부하 감소, 스토리지 자원 최적화.
- **Cons**: 초기 모델 로딩 시간(약 1-2초) 발생, 스토리지 삭제 REST API 의존성 추가.

---

## 2026-02-07: Storage Service gRPC Conversion

### Context

기존 FastAPI 기반 REST API로 운영되던 `storage` 서비스를 시스템 내 다른 마이크로서비스(`stt`, `tts`, `llm` 등)와의 통신 일관성을 위해 gRPC로 전환해야 함.

### Decisions

1.  **gRPC Protocol Adoption**:
    - `storage.proto`를 정의하여 `GetPresignedUrl` 및 `DeleteObject` 인터페이스 명세화.
2.  **Hybrid Server Pattern**:
    - Python 기반 gRPC 서버를 구현하되, 기존의 Redis Queue 기반 비동기 오디오 업로드 워커(Worker)를 백그라운드 스레드로 병렬 유지.
3.  **Core-Storage gRPC Client**:
    - Core 서비스(Java)의 `StorageRestAdapter`를 `StorageGrpcAdapter`로 교체하여 타입 안정성 및 통신 효율 개선.

### Consequences

- **Pros**: 전체 시스템의 통신 프로토콜 단일화(gRPC), REST 오버헤드 제거, 강력한 타입 체크 보장.
- **Cons**: REST API를 직접 호출하던 기존 개발/테스트 도구 사용 불가 (gRPC 클라이언트 필요).

---

## 2026-02-09: Synchronization of Shared Text-Processing Logic

### Context

동일한 이력서를 업로드했음에도 프론트엔드와 백엔드의 임베딩 값이 달라 유사도가 낮게(0.3) 나오는 문제 발생. 이는 양측의 텍스트 정규화(Whitespace) 및 마스킹(PII) 로직이 미세하게 다르기 때문임.

### Decisions

1.  **Regex & Normalization Synchronization**:
    - 프론트엔드(`resume-validator.ts`)와 백엔드(`text_processor.py`)의 정규식을 하이픈 뿐만 아니라 공백, 마침표를 포함하도록 동일하게 업데이트.
    - 양측 모두 줄바꿈을 포함한 모든 연속 공백을 단일 공백으로 치환하도록 통일.
2.  **Explicit Architectural Debt Recording**:
    - 현재의 "복제된 로직" 방식은 유지보수 시 한쪽이 누락될 위험이 있는 **아키텍처 부채**로 간주함.

### Consequences

- **Pros**: 즉시 동일 파일에 대한 높은 유사도(0.95+) 확보 가능. 별도의 API 호출 없이 로컬에서의 즉각적인 피드백 유지.
- **Cons**: 로직 변경 시 두 곳을 모두 수정해야 하는 강한 결합(Coupling) 발생.
- **Future Work (Improvement)**: 로직 파편화를 완전히 해결하기 위해, 프론트엔드가 텍스트를 추출한 뒤 서버의 `Validation API`를 호출하여 **서버가 생성한 공식 임베딩**을 받아와서 비교하는 구조로 전환을 권장함.

---

## 2026-02-11: Core Service Logging Level Optimization

### Context

Core 서비스에서 불필요하게 많은 `DEBUG` 로그(특히 Actuator health check)와 SQL 로그가 출력되어 운영 및 디버깅 가독성이 떨어지는 문제 발생.

### Decisions

1. **Reduce Log Level from DEBUG to INFO**:
   - `ConfigMap`의 `LOG_LEVEL_CORE` 환경변수 기본값을 `INFO`로 변경.
   - 불필요한 프레임워크 수준의 디버그 로그 차단.
2. **Flyway Noise Reduction**:
   - 로컬 환경(`application-local.properties`)에서 Flyway 로그 레벨을 `INFO`로 조정.

### Consequences

- **Pros**: 로그 가시성 향상, 불필요한 I/O 및 저장 공간 절약.
- **Pros**: 로그 가시성 향상, 불필요한 I/O 및 저장 공간 절약.
- **Cons**: 심층 디버깅 시 일시적으로 로그 레벨을 다시 `DEBUG`로 높여야 함.

---

## 2026-02-11: Interview API Refactoring and List/Resume Functionality

### Context

사용자가 과거 면접 기록을 확인하고, 중단된 면접을 이어할 수 있는 기능이 필요함. 기존 `/v1/interview` 엔드포인트는 단수형을 사용하고 있어 RESTful 관례에 어긋나며, 목록 조회 기능을 추가하기에 부적합함.

### Decisions

1.  **Endpoint Pluralization (`/v1/interview` -> `/v1/interviews`)**:
    - 리소스 컬렉션을 나타내기 위해 엔드포인트 명칭을 복수형으로 변경.
2.  **gRPC `ListInterviews` RPC 추가**:
    - Core 서비스에 `userId`를 통해 해당 사용자의 모든 면접 세션을 조회하는 RPC 정의.
    - `InterviewSessionSummary` 메시지를 통해 필요한 최소 정보(ID, 시작시간, 상태, 도메인 등)만 반환하도록 최적화.
3.  **Core Service: Repository-level Ordering**:
    - `InterviewSessionRepository`에서 `findByCandidate_IdOrderByStartedAtDesc`를 사용하여 항상 최신 면접이 상단에 오도록 보장.
4.  **BFF Service logic**:
    - `GET /v1/interviews` 엔드포인트를 구현하여 프론트엔드와 Core gRPC 간의 가교 역할 수행.
5.  **Frontend: Landing Page Integration**:
    - 메인 페이지(Landing)에 면접 이력을 표시하고, 세션 ID를 기반으로 `/interview/:id` 경로로 이동하여 면접을 재개(Resume)할 수 있도록 구현.

### Consequences

- **Pros**: RESTful 규격 준수, 사용자 편의성(이어하기) 증대, 면접 데이터의 체계적 관리 가능.
- **Cons**: 기존 단수형 API를 호출하던 프론트엔드 코드의 수정이 필요함 (Breaking change).
