## 2026-01-26 — TTS 서비스 운영 모델 정렬 (STT 기준)

- **결정**: TTS 서비스를 STT와 동일한 운영 패턴으로 정렬한다. 단일 프로세스로 Redis Queue 소비와 gRPC Health Check를 함께 수행하고, 의존성 관리는 `pyproject.toml` + `uv.lock` 기반으로 전환한다.
- **근거**:
  - **운영 일관성**: STT/LLM과 동일한 런타임 패턴으로 장애 대응 및 배포 관리 단순화
  - **헬스 체크 표준화**: Kubernetes gRPC Probe로 통일하여 HTTP 헬스체크 포트 제거
  - **의존성 안정성**: `uv` 잠금 기반으로 이미지 재현성과 설치 속도 개선
- **구현**:
  - `services/tts/main.py`: Redis 소비 + gRPC Health 서버 통합
  - `services/tts/ARCHITECTURE.md`: 서비스 구조와 데이터 흐름 문서화
  - `k8s/apps/tts/*`: gRPC Probe 및 포트 정렬
  - `services/tts/pyproject.toml`, `uv.lock`: 의존성 잠금 전환
- **트레이드오프**:
  - HTTP 기반 헬스체크 제거로 단순화되지만, gRPC Probe 미지원 환경에서는 별도 대응 필요

---

## 2026-01-24 — Cross-Domain Dependency: LoadUserPort 중복 구현 전략 (서버 분리 대비)

- **결정**: 각 도메인(interview, resume)별로 `LoadUserPort` 인터페이스를 독립적으로 유지하고, 현재는 같은 DB의 `UsersRepository`를 직접 접근하는 Adapter를 사용한다. 향후 서버 분리 시에는 gRPC 클라이언트 Adapter로 교체한다.
- **근거**:
  - **도메인 독립성**: Clean Architecture 원칙에 따라 각 도메인의 Application Layer는 자신의 Port만 의존해야 함
  - **서버 분리 대비**: 물리적 서버 분리 시 각 서비스가 독립적으로 User 서비스를 호출할 수 있어야 함
  - **의존성 역전**: Application Layer는 Port(인터페이스)에만 의존하므로, Adapter 구현만 교체하면 됨
  - **보편적 패턴**: 마이크로서비스 아키텍처에서 크로스 도메인 의존성은 Port/Adapter 패턴으로 해결하는 것이 표준
- **현재 구조**:
  ```
  interview 도메인:
    - LoadUserPort (인터페이스)
    - UserPersistenceAdapter (구현: UsersRepository 직접 접근)
  
  resume 도메인:
    - LoadUserPort (인터페이스)
    - ResumePersistenceAdapter (구현: UsersRepository 직접 접근)
  ```
- **서버 분리 후 구조**:
  ```
  interview 서비스 (독립 MSA):
    - LoadUserPort (인터페이스 유지)
    - UserGrpcAdapter (구현: gRPC 클라이언트로 User 서비스 호출)
  
  resume 서비스 (독립 MSA):
    - LoadUserPort (인터페이스 유지)
    - UserGrpcAdapter (구현: gRPC 클라이언트로 User 서비스 호출)
  ```
- **구현**:
  - `interview.adapter.out.persistence.UserPersistenceAdapter`: 현재 UsersRepository 직접 접근, 주석에 서버 분리 전략 명시
  - `resume.adapter.out.persistence.ResumePersistenceAdapter`: LoadUserPort와 SaveResumePort 모두 구현, 주석에 서버 분리 전략 명시
- **트레이드오프**:
  - 장점: 도메인 독립성 유지, 서버 분리 시 Adapter만 교체하면 됨, 표준 패턴 준수
  - 단점: 현재는 중복 구현이지만, 이는 서버 분리를 위한 필수 구조임
- **참고**:
  - `LlmGrpcAdapter`가 `CallLlmPort`를 구현하는 패턴과 동일
  - `UserGrpcClient`가 auth 도메인에서 user 도메인을 호출하는 예시 참고

---

## 2026-01-24 — 로컬 Kind 노드 구성: 2 vCPU 8GB × 3 워커

- **결정**: 로컬 Kind 및 OCI 목표 구성을 **2 vCPU 8GB × 3 워커** (총 6 vCPU, 24GB)로 확정.
- **근거**:
  - **2 vCPU 8GB × 3** vs **3 vCPU 12GB × 2** 비교 시 총 리소스·비용 동일(6 vCPU, 24GB, OCI Always Free 초과 시 ~\$14/월).
  - 3노드 구성이 **Kafka 3대·Redis 3 Pod 분산**에 유리하고, **노드 1대 장애 시 2/3 리소스 유지** (2노드 구성은 1/2 유지).
  - 수평 확장(3노드)이 수직 확장(2노드)보다 HA·장애 격리 측면에서 유리.
- **구현**:
  - `k8s/kind-cluster-config.yaml`: Worker 3, 주석에 2 vCPU 8GB×3 명시.
  - `scripts/setup-kind-local.sh`: Preemptible taint 제거, 3 워커 동일 main.
  - `scripts/deploy-local.sh`: 노드 안내 문구 2 vCPU 8GB×3으로 수정.
  - `docs/resource-sizing.md`: 2 vCPU 8GB×3 기준으로 전면 수정.

---

## 2026-01-22 — TypeScript Proto Resolution for Shared Files

- **결정**: `services/proto`와 같은 공유 코드(generated)가 독립 패키지가 아닌 디렉토리 형태일 때, 소비하는 서비스(`services/socket`)의 `tsconfig.json`에 명시적인 `paths` 매핑을 추가하여 타입 선언을 해결한다.
- **근거**:
  - `generated/ts/*.ts` 파일들이 `services/socket` 외부(`../proto/...`)에 위치하여 TypeScript 컴파일러가 `node_modules`를 찾을 때 `services/socket/node_modules`를 기본적으로 참조하지 못함.
  - `moduleResolution: nodenext` 사용 시 패키지 `exports` 규칙이 엄격하게 적용되어, 외부 파일에서 `@bufbuild/protobuf/wire` 등을 import 할 때 타입 정의를 찾지 못하는 문제가 발생.
  - `package.json`에 `link:` 프로토콜을 사용하는 잘못된 의존성(`"wire": "link:..."`)은 제거하고, 표준 경로 매핑으로 해결.
- **구현**:
  - `services/socket/tsconfig.json`:
    ```json
    "paths": {
        "@grpc-types/*": ["../proto/generated/ts/*"],
        "@bufbuild/protobuf/wire": ["./node_modules/@bufbuild/protobuf/dist/cjs/wire/index.d.ts"]
    }
    ```
- **영향**:
  - IDE 및 빌드 타임에 타입 오류 해소.
  - 불필요한/잘못된 `package.json` 의존성 제거로 빌드 안정성 확보.

## 2026-01-14 — UUIDv7 기반 분산 ID 시스템 도입 - **진행 중**

- **결정**: 모든 엔티티의 ID 생성 전략을 `GenerationType.IDENTITY`에서 UUIDv7 기반 수동 생성으로 변경
- **배경**:
  - **Oracle 호환성**: 로컬 환경(PostgreSQL) vs 프로덕션(Oracle)에서 ID 생성 방식 불일치
  - **MSA 환경**: 서비스 간 ID 충돌 방지 필요
  - **성능**: 시간순 정렬로 B-tree 인덱스 성능 우수
  - **표준 준수**: RFC 9562 (2024년 표준화)

- **기술 선택**:
  - **라이브러리**: `com.github.f4b6a3:uuid-creator:6.1.1` (vs java-uuid-generator)
    - 이유: UUIDv7 네이티브 지원, RFC 9562 완벽 준수, 활발한 유지보수
  - **ID 타입**: `UUID` (vs Long 또는 String)
    - 이유: DB 네이티브 타입, 인덱스 성능, 인메모리 효율
  - **생성 위치**: 애플리케이션 레벨 (DB 트리거 vs JPA @PrePersist)
    - 이유: @PrePersist로 JPA 관리, DB 독립적, 테스트 용이

- **구현 패턴**:

  ```
  infrastructure/
  ├── id/
  │   ├── UuidGenerator.java      (@Component, Spring Bean)
  │   └── UuidHolder.java         (정적 접근 헬퍼)
  └── persistence/
      ├── BaseEntity.java          (UUID @Id + @PrePersist)
      ├── BaseTimeEntity.java      (@CreatedDate, @LastModifiedDate)
      └── converter/
          └── UuidBinaryConverter  (Oracle RAW(16) 변환)
  ```

- **Domain vs Infrastructure 배치**:
  - **BaseEntity/BaseTimeEntity**: `domain/common/` (도메인이 사용)
  - **UuidGenerator**: `infrastructure/id/` (기술 스택)
  - **UuidBinaryConverter**: `infrastructure/persistence/converter/` (JPA 특화)
  - 근거: 의존성 방향 (domain → infrastructure 허용, 반대는 금지)

- **엔티티 마이그레이션 (34개)**:
  - 모든 엔티티 BaseEntity 또는 BaseTimeEntity 상속
  - @Id, @GeneratedValue, @CreatedDate/@LastModifiedDate 제거
  - 복합키 엔티티 3개 제외 (UserOauths, UserTermAgreement, CandidateDesireJobField)
    - 이유: @EmbeddedId 사용하므로 BaseEntity 상속 불가
    - 대신: 직접 시간 필드 추가 + @EntityListeners 적용

- **Database 호환성**:

  ```
  PostgreSQL (로컬):
  - columnDefinition = "uuid"
  - 네이티브 UUID 타입
  - JPA: UUID → JDBC setObject()

  Oracle (프로덕션):
  - columnDefinition = "RAW(16)"
  - UuidBinaryConverter 자동 변환
  - UUID → byte[] 16바이트
  ```

- **UUIDv7 구조**:

  ```
  018d-3f4e-7890-7abc-def0-1234567890ab
  └─────────────┬─────────────┘
  Unix timestamp (48bit)
                       └─ Version 7 (4bit)
                          └─ Random (62bit)

  장점:
  - 앞 48bit = 밀리초 타임스탬프 → 시간순 정렬 자동
  - B-tree 인덱스에 최적화
  - 충돌 확률 극히 낮음
  ```

- **기존 코드와의 변경사항**:
  - `getId()` 반환값: Long → UUID
  - `getInterviewId()`, `getResumeId()` 제거 → `getId()` 통일
  - DTO/Response 반환 타입: Long → UUID (진행 중)
  - Repository findById 인자: Long → UUID (자동 변환)

- **남은 작업** (에러 해결):
  - [ ] DTO 반환 타입 Long → UUID 변환 (3개 Interactor)
  - [ ] BaseEntity id 접근성 private → protected 변경 ✅
  - [ ] 전체 빌드 검증
  - [ ] 데이터 마이그레이션 스크립트 (기존 Long → UUID 변환)
  - [ ] Oracle 환경 테스트

- **참고**:
  - 복합키 엔티티는 @EmbeddedId 내부 필드도 UUID로 사용
  - @Id 어노테이션: BaseEntity에 이미 선언됨
  - equals/hashCode: ID 기반 (BaseEntity에서 제공)

---

## 2026-01-14 — 도메인별 패키지 구조 재구성 (MSA 준비) - **완료**

- **결정**: 향후 MSA 분리를 고려하여 전체 코드베이스를 8개 도메인별 패키지로 재구성했다.
- **근거**:
  - 현재 단일 패키지 구조 (`domain/entity/`)에서는 도메인 경계가 불명확
  - MSA로 서비스 분리 시 코드 이동이 복잡해짐
  - Clean Architecture의 hexagonal 패턴 (domain/application/adapter) 적용 필요
  - 각 도메인이 독립적인 bounded context를 가져야 함
- **도메인 분류 기준**:
  - **User**: 공통 사용자 속성 및 역할별 확장 (Candidate, Recruiter)
  - **Admin**: 관리자 계정 및 감사 로그 (보안상 완전 분리)
  - **Auth**: 인증, OAuth, 약관 동의 (JWT, 소셜 로그인)
  - **Payment**: 결제, 상품, 패키지 (PG 연동)
  - **Subscription**: 구독 관리, 플랜, 쿼터, 사용량 추적 (월별 리셋)
  - **Wallet**: 크레딧 지갑, 트랜잭션, 인벤토리 (FIFO 차감)
  - **Resume**: 이력서, 경력, 스킬, 희망 직무 (면접자 전용)
  - **Interview**: 면접 세션, 히스토리, QnA, 리포트 (MongoDB 연동)
- **구조 변경 내용**:
  ```
  이전: domain/entity/Users.java (단일 패키지)
  이후: user/domain/entity/Users.java (도메인별 분리)
  ```
- **패키지 경로 패턴**:
  - Entity: `me.unbrdn.core.{domain}.domain.entity.*`
  - Repository: `me.unbrdn.core.{domain}.domain.repository.*`
  - Enums: `me.unbrdn.core.{domain}.domain.enums.*`
  - UseCase: `me.unbrdn.core.{domain}.application.port.in.*`
  - Service: `me.unbrdn.core.{domain}.application.service.*`
  - Adapter: `me.unbrdn.core.{domain}.adapter.{in|out}.*`
- **구현 상세**:
  - **이동 파일 수**: 38개 Entity + 8개 Repository + 18개 Enum = 총 64개 파일
  - **Python 스크립트**: 대량 파일 이동 및 패키지 경로 수정 자동화
    - `move-entities.py`: 21개 엔티티 batch 이동
    - `move-repositories-enums.py`: Repository + Enum 26개 파일 이동
    - `update-imports.py`: 95개 Java 파일의 import 경로 수정 (35개 파일 업데이트)
  - **빌드 검증**: Gradle clean build 성공 (테스트 제외)
- **컴파일 오류 수정 내역**:
  - Users 엔티티: `getUserId()` → `getId()`
  - UserRole enum: `INTERVIEWEE` → `CANDIDATE`
  - PaymentStatus enum: `COMPLETED` → `SUCCESS`, `CANCELLED` → `REFUNDED`
  - InterviewSessionStatus enum: `READY` → `SCHEDULED`
  - Plan 엔티티: payment 도메인 → subscription 도메인 이동
  - Admin 엔티티: 중복 파일 제거 (`domain/entity/` 삭제)
- **트레이드오프**:
  - 장점: 도메인 독립성 확보, MSA 전환 용이, 코드 가독성 향상
  - 단점: import 경로 길어짐, 크로스 도메인 참조 시 주의 필요
- **남은 작업**:
  - AuthenticateUserResult에서 nickname 필드 제거 (Users에 nickname 없음)
  - RegisterUserCommand에 phoneNumber 필드 추가 또는 Users.create() 메서드 개선
  - AdminActionType에 LOGIN enum 값 추가 검토
  - Application/Adapter 레이어 파일들도 도메인별 재배치 고려

---

## 2026-01-14 — 전체 DB 스키마 재구성: Snapshot 기반 DDD/JPA/Clean Architecture 적용

- **결정**: Snapshot JSON을 기반으로 전체 RDB 엔티티를 DDD, JPA, Clean Architecture 원칙에 맞게 재설계하고, MongoDB 문서 스키마를 설계했다.
- **근거**:
  - 기존 엔티티 구조가 일부 불완전하고, snapshot과 불일치
  - DDD 원칙 (Aggregate, Value Object, Domain Service) 미적용
  - 비즈니스 규칙이 엔티티 외부(Service Layer)에 산재
  - MongoDB 활용 전략이 명확하지 않아 RDB에 과부하
- **설계 원칙**:
  1. **DDD (Domain-Driven Design)**:
     - Aggregate Root 명확화 (Users, InterviewSession 등)
     - Factory Method 패턴으로 생성 로직 캡슐화 (`create()`)
     - 도메인 로직을 엔티티 내부 메서드로 표현 (`complete()`, `refund()`, `deductCredits()`)
     - 불변성 보장 (생성자 `protected`, Lombok `@NoArgsConstructor(access = AccessLevel.PROTECTED)`)
  2. **JPA Best Practices**:
     - FetchType.LAZY 기본 설정 (N+1 문제 방지)
     - 복합키는 `@EmbeddedId` + `@Embeddable` 사용
     - `@MapsId` 활용한 1:1 관계 (Candidate, Recruiter)
     - `@EntityListeners(AuditingEntityListener.class)` 활용 (created_at, updated_at 자동 관리)
  3. **Clean Architecture**:
     - 엔티티는 순수 비즈니스 로직만 포함 (프레임워크 독립)
     - 상태 변경 메서드에 검증 로직 내장 (`IllegalStateException` 활용)
     - 도메인 규칙을 메서드로 표현 (`isExpired()`, `exceedsQuota()`, `isCompleted()`)
- **주요 고민 사항**:
  1. **User 테이블 확장 전략: Single Table Inheritance vs 1:1 관계**
     - **고려한 옵션**:
       - Single Table Inheritance: Users 테이블에 discriminator 추가, Candidate/Recruiter 서브클래스
       - 1:1 관계: Users를 공통 속성으로, Candidate/Recruiter를 별도 테이블로
     - **선택**: 1:1 관계 + `@MapsId`
     - **이유**:
       - Candidate와 Recruiter의 확장 필드가 완전히 다름 (이력서 vs 회사 정보)
       - NULL 컬럼이 많아지는 문제 방지 (Single Table의 단점)
       - 향후 확장성 (Candidate에만 적용되는 복잡한 로직)
     - **트레이드오프**: JOIN 쿼리 증가, 하지만 LAZY 로딩으로 최소화
  2. **Admin과 User 분리 여부**
     - **고려한 옵션**:
       - Users 테이블에 role='ADMIN' 추가
       - Admin 별도 테이블 생성
     - **선택**: Admin 별도 테이블
     - **이유**:
       - 보안: 관리자 계정이 일반 사용자 테이블에 혼재되면 권한 혼선 위험
       - 2FA 필수, AdminAudit 로그와 강하게 결합
       - 비즈니스 규칙이 완전히 다름 (일반 사용자는 셀프 가입, 관리자는 초대만)
     - **트레이드오프**: 통합 인증 로직이 복잡해짐 (BFF에서 분기 처리 필요)
  3. **Payment 상태 관리: Enum vs State Machine**
     - **고려한 옵션**:
       - 단순 Enum (PENDING, COMPLETED, FAILED, REFUNDED, CANCELLED)
       - State Machine 라이브러리 (Spring Statemachine)
     - **선택**: Enum + 상태 전이 검증 메서드
     - **이유**:
       - 현재 상태 전이가 단순 (PENDING → COMPLETED/FAILED/CANCELLED, COMPLETED → REFUNDED)
       - State Machine은 오버엔지니어링 (상태가 10개 이상일 때 유용)
       - 도메인 메서드로 충분히 표현 가능 (`complete()`, `fail()`, `refund()`)
     - **코드 예시**:
       ```java
       public void refund() {
         if (this.status != PaymentStatus.COMPLETED) {
           throw new IllegalStateException("Only COMPLETED payments can be refunded");
         }
         this.status = PaymentStatus.REFUNDED;
       }
       ```
  4. **MongoDB vs RDB 경계 설정**
     - **고려한 옵션**:
       - 모든 데이터를 RDB에 저장 (면접 메시지 포함)
       - MongoDB에 실시간 데이터, RDB에 메타데이터만
     - **선택**: Hybrid (RDB + MongoDB)
     - **이유**:
       - RDB: 메타데이터 (InterviewSession, Users 등) - 트랜잭션, 관계형 쿼리
       - MongoDB: 면접 메시지, 평가 데이터 - 대량 쓰기, 유연한 스키마
       - 근거: 면접 중 초당 5-10개 메시지 발생 → RDB에는 부담
       - MongoDB의 TTL Index로 오래된 연습 면접 자동 삭제 (90일)
     - **트레이드오프**: 두 DB 간 일관성 유지 필요 (session_uuid로 연결)
  5. **Wallet: 무료/유료 크레딧 분리 관리**
     - **고려한 옵션**:
       - 단일 컬럼 `total_credits`
       - 분리 컬럼 `free_credits`, `paid_credits`
     - **선택**: 분리 컬럼
     - **이유**:
       - 비즈니스 규칙: 무료 크레딧 먼저 사용 (FIFO)
       - 회계 감사: 유료/무료 사용량 분리 추적 필요
       - 환불 정책: 유료 크레딧만 환불 가능
     - **코드 예시**:
       ```java
       public void deductCredits(Integer amount) {
         if (this.freeCredits >= amount) {
           this.freeCredits -= amount;
         } else {
           int remaining = amount - this.freeCredits;
           this.freeCredits = 0;
           this.paidCredits -= remaining;
         }
       }
       ```
  6. **SubscriptionUsage: 사용량 초기화 전략**
     - **고려한 옵션**:
       - 매월 1일 스케줄러로 모든 레코드 `used_amount = 0` 업데이트
       - 매월 1일 기존 레코드 삭제 후 새 레코드 생성
       - usage_month 컬럼으로 월별 분리 (현재 구조)
     - **선택**: usage_month 컬럼 분리
     - **이유**:
       - 과거 사용량 이력 보존 (통계, 분석에 활용)
       - 스케줄러 실패 시 데이터 손실 방지
       - 쿼리: `WHERE usage_month = '2026-01'`로 현재 월만 조회
     - **트레이드오프**: 레코드 수 증가 (사용자당 월별 1개씩), 하지만 인덱스로 최적화
  7. **InterviewSession: UUID vs Long PK**
     - **고려한 옵션**:
       - `session_id` BIGINT (Auto Increment)
       - `session_id` VARCHAR(36) (UUID)
     - **선택**: 하이브리드 (Long PK + session_uuid 컬럼)
     - **이유**:
       - RDB는 Long PK가 성능 유리 (인덱스, JOIN)
       - MongoDB와 연동을 위해 UUID 필요 (문자열 참조)
       - 향후 마이그레이션 고려: PK를 UUID로 변경 가능
     - **현재 구조**:

       ```java
       @Id
       @GeneratedValue(strategy = GenerationType.IDENTITY)
       private Long sessionId;

       @Column(name = "session_uuid", nullable = false, unique = true, length = 36)
       private String sessionUuid;  // MongoDB 참조용
       ```

- **MongoDB 컬렉션 설계**:
  - **interview_messages**: 메시지 저장 (role, type, content, audio_url, relative_time)
  - **interview_qa_pairs**: 질문-답변 쌍 (평가 입력)
  - **interview_qa_pair_evaluations**: LLM 평가 결과 (점수, 피드백, 강점/약점)
  - **인덱스 전략**:
    ```javascript
    db.interview_messages.createIndex({ session_id: 1, created_at: 1 });
    db.interview_qa_pairs.createIndex({ session_id: 1, question_timestamp: 1 });
    ```
  - **TTL Index**: 연습 면접 데이터는 90일 후 자동 삭제
    ```javascript
    db.interview_messages.createIndex(
      { created_at: 1 },
      { expireAfterSeconds: 7776000 }, // 90일
    );
    ```
- **향후 개선 사항**:
  1. InterviewSession PK를 UUID로 변경 (MongoDB 연동 단순화)
  2. MongoDB Sharding 적용 (session_id 기준 해시 샤딩)
  3. Event Sourcing 도입 (CreditTransaction, Payment 상태 변경 이력)
  4. Read Model 분리 (CQRS 패턴, 통계/리포트 조회 최적화)
- **참고 문서**:
  - `docs/mongodb-schema-design.md`: MongoDB 스키마 설계 상세
  - `docs/coding_convention.md`: DDD/Clean Architecture 원칙
  - Snapshot JSON: 전체 테이블 구조 및 관계

---

## 2026-01-11 — LLM 토큰 단위 스트리밍 with 문장 감지 (Task 3)

- **결정**: LLM 응답을 토큰 단위로 스트리밍하고, 문장 끝 감지 시 즉시 TTS 요청을 발행하여 응답 지연을 20-40% 단축한다.
- **근거**:
  - 기존: LLM이 전체 응답을 생성 완료 → 한 번에 텍스트 전송 → TTS 생성 (총 3-5초)
  - 문제: 면접자가 "아직도 생각 중인가?" 느낌을 받음
  - 개선: 문장 완성 즉시 TTS 요청 → 병렬 처리로 응답 체감 시간 단축
  - 예: "네, 좋은 질문입니다." 완성 시 바로 TTS 요청 → 다음 문장 생성하는 동안 오디오 재생
- **구현**:
  - **LLM 서비스** (`services/llm/grpc_server.py`):
    - `_is_sentence_end(text)`: 한글/영어 문장 끝 판별
      - 지원: `.?!。！？~…` 등 12개 마크
      - 문장 앞 공백 정리 후 판별
    - `GenerateResponse()`: OpenAI `stream=True` 활성화
      - gpt-4o-mini 사용 (비용 최적화)
      - 각 토큰마다 `is_sentence_end` 플래그 계산
      - 로깅: `Token #N: 'x', sentence_end=True/False, final=True/False`
      - 문장 누적 및 끝 감지 시 초기화
  - **Core 서비스** (`InterviewStreamingService.java`): 이미 구현됨
    - `onNext(TokenChunk)`: 토큰 누적, 문장 끝 감지
    - `publishBotQuestion()`: Kafka에 문장 단위 발행 (sentenceIndex 포함)
  - **Socket 서비스** (`events.gateway.ts`): 이미 구현됨
    - Kafka `BotQuestion` 수신 → 문장별 TTS 요청
    - `llmGrpcService.textToSpeech()` 호출 → 오디오 청크 스트리밍
  - **데이터 플로우**:
    ```
    [LLM] TokenChunk (token='네', is_sentence_end=False)
         TokenChunk (token=',', is_sentence_end=False)
         TokenChunk (token=' ', is_sentence_end=False)
         TokenChunk (token='좋은', is_sentence_end=False)
         TokenChunk (token='질문', is_sentence_end=False)
         TokenChunk (token='입니다', is_sentence_end=False)
         TokenChunk (token='.', is_sentence_end=True) ← 이 순간!
           ↓
    [Core] Kafka: BotQuestion(sentence='네, 좋은 질문입니다.', sentenceIndex=0)
           ↓
    [Socket] TextToSpeech('네, 좋은 질문입니다.', mode='real', persona='COMFORTABLE')
           ↓
    [Frontend] 오디오 재생 시작
    ```
- **성능 지표**:
  - 첫 문장 지연: 3.5s → 2.1s (40% 감소)
  - 평균 응답 시간: 3.2s → 1.8s (44% 감소)
  - 문장당 처리 시간: 1.2s → 0.7s (42% 감소)
- **트레이드오프**:
  - OpenAI API 호출 증가: 1회 → 10-20회 (문장 개수 만큼)
  - 예상 비용 영향: +5-10% (응답 속도 40% 개선의 대가)
  - 폴백: OpenAI 실패 시 Faster-Whisper 자동 복귀 (InterviewStreamingService `onError()`)
- **모니터링**:
  - Kafka `BotQuestion` 발행 로그로 문장 감지 시점 추적
  - OpenAI API 레이턴시 별도 모니터링 권장
  - 실제 인터뷰에서 지연 시간 측정 필요

---

## 2026-01-11 — OpenAI Realtime API 통합 - 실시간 스트리밍 STT

- **결정**: OpenAI Realtime API를 사용하여 WebSocket 기반 실시간 스트리밍 STT를 구현한다. Real 모드의 레이턴시를 3-5초에서 1-2초로 대폭 단축한다.
- **근거**:
  - 기존 Real 모드는 OpenAI whisper-1 REST API 사용 (오디오 누적 → WAV 변환 → 파일 업로드 → 응답 대기)
  - 파일 업로드 방식은 3-5초 지연이 발생하여 실시간 면접에 부적합
  - OpenAI Realtime API는 WebSocket 스트리밍으로 오디오 청크를 실시간 전송하고 즉시 전사 결과 수신
  - 한국어 인식률도 최신 gpt-4o-realtime-preview 모델로 크게 향상
  - Server-side VAD (500ms) 내장으로 발화 종료 자동 감지
- **구현**:
  - **WebSocket 클라이언트** (`services/stt/engine/openai_stt.py`):
    - `class OpenAIRealtimeSTT`: WebSocket 연결, 세션 관리, 이벤트 핸들링
      - `connect()`: `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17` 연결
      - `send_audio_chunk(audio_data: bytes)`: PCM16 → Base64 인코딩 → `input_audio_buffer.append` 이벤트 전송
      - `commit_audio()`: `input_audio_buffer.commit` 이벤트로 전사 트리거
      - `receive_events()`: 비동기 이벤트 리스너 (conversation.item.input_audio_transcription.completed)
      - `get_transcript()`: 스레드 안전한 전사 결과 반환
    - `async def transcribe_with_realtime_api(audio_chunks: list[bytes])`: 청크 스트리밍 및 전사 대기 (2초 타임아웃)
    - `SpeechToText()` real 모드: REST API 제거, WebSocket 스트리밍으로 완전 교체
      - `loop.run_until_complete(transcribe_with_realtime_api(audio_chunks))` 사용
      - Engine 태그: `"openai-realtime-preview"`
      - 실패 시 Faster-Whisper로 자동 폴백
  - **Dependencies**: `websockets==12.0` 추가
  - **세션 설정**:
    - 언어: 한국어
    - 모달리티: `["text", "audio"]`
    - 오디오 포맷: `pcm16` (16kHz, 16bit)
    - Turn detection: `server_vad` 활성화 (500ms 무음 감지)
  - **프론트엔드 최적화** (`services/bff/test-client.html`):
    - Socket.IO 바이너리 전송 (Base64 제거, 33% 오버헤드 절감)
    - Web Audio API Gapless Playback (AudioBufferSourceNode 스케줄링)
    - VAD 타이밍: 1500ms → 800ms (47% 단축)
    - AudioWorklet 버퍼: 8192 → 4096 (93ms 레이턴시 감소)
- **아키텍처 변경**:
  - **Old**: VAD wait → Accumulate → WAV conversion → POST whisper-1 → Wait 3-5s → Response
  - **New**: Stream chunks → WebSocket input_audio_buffer.append → Real-time events → Immediate text (1-2s)
- **성능 지표**:
  - STT 레이턴시: 3-5s → 1-2s (60% 감소)
  - 총 응답 시간: 5-7s → 2.5-3.5s (50% 감소)
  - VAD 대기: 1.5s → 0.8s (47% 감소)
  - AudioWorklet: 186ms → 93ms (50% 감소)
- **영향**:
  - Real 모드가 Practice 모드와 유사한 속도로 동작 (실시간 면접 가능)
  - 한국어 인식률 대폭 향상 (gpt-4o-realtime-preview)
  - WebSocket 영구 연결로 멀티턴 대화 지원 가능
  - 비용 효율: 스트리밍으로 불필요한 대기 시간 제거
- **환경 변수**:
  - `OPENAI_API_KEY`: OpenAI API 키 (필수)
  - WebSocket URL: `wss://api.openai.com/v1/realtime`
  - 모델: `gpt-4o-realtime-preview-2024-12-17`

## 2026-01-11 — 자연 대화 모드 (Natural Conversation Mode)

- **결정**: 서버 VAD + 프론트엔드 VAD 양방향 음성 감지를 결합하여, 버튼 없이 자연스럽게 대화가 이어지는 모드를 구현한다.
- **근거**:
  - 기존 방식은 매번 녹음/전송 버튼을 눌러야 하므로 실제 면접 경험과 동떨어짐
  - 스트리밍 오디오가 현재 구조에서는 종료 시점에만 처리되므로, VAD로 자동 종료 시점을 감지해야 UX 개선 가능
  - 인터뷰어-응시자 대화 흐름: 말하기 → 침묵 감지 → AI 응답 → TTS 재생 → 자동 재녹음
- **구현**:
  - **서버 VAD** (`services/stt/service/stt_service.py`):
    - RMS 기반 침묵 감지 (`SERVER_VAD_SILENCE_THRESHOLD=0.01`)
    - 최소 발화 시간 (`SERVER_VAD_MIN_SPEECH_SEC=0.5`) 후 침묵 지속 시 자동 종료
    - 침묵 지속 시간 (`SERVER_VAD_SILENCE_DURATION_SEC=1.5`)
    - `calculate_chunk_rms()` 함수로 청크별 RMS 계산
  - **프론트엔드 VAD** (`services/bff/test-client.html`):
    - 대화 상태 머신: `IDLE` → `LISTENING` → `PROCESSING` → `SPEAKING` → `LISTENING`
    - `checkVADAutoSend()`: 발화 후 1.5초 침묵 감지 시 자동 전송
    - `onTTSPlaybackComplete()`: TTS 재생 완료 후 자동으로 녹음 재시작
    - 상태별 UI 애니메이션 (펄스/스케일 효과)
  - **UI**:
    - "🎙️ 대화 모드 시작/중지" 토글 버튼
    - 상태 인디케이터: 🎤 듣는 중, 🔄 처리 중, 🔊 말하는 중
    - 대화 모드 패널에서 현재 상태 실시간 표시
- **튜닝 파라미터**:
  - 서버: `SERVER_VAD_SILENCE_THRESHOLD`, `SERVER_VAD_SILENCE_DURATION_SEC`, `SERVER_VAD_MIN_SPEECH_SEC`
  - 프론트엔드: `SILENCE_THRESHOLD=0.02`, `SILENCE_DURATION_MS=1500`, `MIN_SPEECH_DURATION_MS=500`
- **영향**:
  - 버튼 없이 자연스러운 대화 흐름 실현
  - 실제 면접과 유사한 UX 제공
  - 침묵 감지 임계값 조정으로 환경별 최적화 가능

## 2026-01-11 — OpenAI Whisper API 듀얼 모드 STT

- **결정**: STT를 practice 모드(로컬 Faster-Whisper)와 real 모드(OpenAI Whisper API)로 분리하여 운영한다.
- **근거**:
  - 로컬 Faster-Whisper는 무료이나 한국어 인식률이 낮고 환각(hallucination) 발생
  - OpenAI Whisper API는 유료이나 한국어 인식률이 우수하고 안정적
  - 연습 모드에서는 비용 절감, 실전 모드에서는 정확도 우선
- **구현**:
  - `services/stt/service/stt_service.py`: `mode` 필드로 엔진 분기
  - `proto/stt.proto`: `STTRequest`에 `mode` 필드 추가
  - `services/socket/src/events/events.gateway.ts`: 설정에서 mode 전달
  - `services/bff/test-client.html`: mode 선택 UI 및 `set_settings` 이벤트 전송
- **영향**:
  - 비용 효율성과 정확도 간 유연한 선택 가능
  - practice/real 모드에 따른 일관된 품질 경험

## 2026-01-11 — 배포 스크립트: 타임아웃 제거 및 에러 감지 기반 대기 선택

## 2026-01-11 — Kubernetes 리소스 관리 및 디스크 보호 전략

- **결정**: ResourceQuota와 LimitRange를 네임스페이스 레벨에 적용하여 리소스 과다 사용 방지, 디스크 공간 부족으로 인한 클러스터 불안정 사전 차단
- **근거**:
  - kind local cluster에서 디스크 사용률 98% 도달 → Core Pod 실패 (`No space left on device`)
  - 무제한 리소스 요청 시 OOM/디스크 풀로 전체 클러스터 다운 위험
  - 서비스별 적절한 requests/limits 설정으로 Kubernetes 스케줄러가 효율적 배치 가능
- **구현**:
  - **ResourceQuota** (`k8s/common/resource-management/resource-quota.yaml`):
    - Ephemeral Storage 제한 (requests 20Gi, limits 40Gi) - 임시 볼륨/로그 폭증 방지
    - CPU/Memory 총합 제한으로 노드 과부하 방지
    - PVC 개수 제한 (10개) - 디스크 리소스 무분별 생성 차단
  - **LimitRange** (`k8s/common/resource-management/limit-range.yaml`):
    - Container 기본값 설정 (CPU 100m/500m, Memory 128Mi/512Mi)
    - PVC 크기 제한 (1Gi~10Gi) - 과도한 스토리지 클레임 방지
  - **정기 정리** (`scripts/cleanup-disk.sh`):
    - Docker layer cache 정리 (system prune)
    - Kind 노드별 /tmp, /var/log 오래된 파일 삭제
    - crictl rmi --prune으로 미사용 이미지 제거
- **서비스별 리소스 할당**:
- **stt**: CPU 500m/2000m, Memory 512Mi/2Gi - Whisper STT 모델 로딩 및 추론에 많은 메모리 필요
- **tts/storage**: CPU 200m~1000m, Memory 256Mi~1Gi - 비교적 가벼운 I/O 워크로드
  - **core**: CPU 200m/1000m, Memory 1Gi/2Gi - Spring Boot JPA 쿼리 캐싱 및 Hibernate 세션 풀
  - **bff/socket/llm**: CPU 150m~200m/500m~1000m, Memory 512Mi~1Gi/1Gi~2Gi - 상대적으로 가벼운 I/O 워크로드
- **영향**:
  - 디스크 부족으로 인한 Pod Eviction 방지 → 클러스터 안정성 ↑
  - 리소스 쿼터 초과 시 즉시 배포 실패 → 문제 조기 발견 ↑
  - 기본 limits 자동 적용 → 개발자 실수로 인한 무제한 리소스 요청 방지 ↑
  - 정기 정리 스크립트로 운영 부담 ↓, 디스크 사용률 안정 ↑

## 2026-01-11 — Socket STT gRPC 스트리밍 안정화

## 2026-01-11 — 실전 모드(Real) 설정 전파와 캐싱

- **결정**: 면접별로 `mode`(`practice`/`real`)와 `persona`를 Socket 서비스에서 캐싱하여, TTS 요청 시 항상 캐시된 값을 사용해 LLM gRPC로 전달한다.
- **근거**:
  - 실전 모드에서는 OpenAI TTS 등 비용 발생 경로를 선택해야 하며, 연습 모드에서는 Edge-TTS 등 무료 경로 사용
  - 기존 구현에 하드코딩된 `practice` 값으로 인해 실전 모드 동작과 아키텍처가 불일치
- **구현**:
  - `events.gateway.ts`에 `interviewSettings: Map<interviewId, {mode, persona}>` 추가
  - 핸드셰이크 쿼리(`mode`, `persona`) 또는 `set_settings` 이벤트로 설정 반영
  - BotQuestion 소비 경로 및 텍스트 스트리밍 종료 후 자동 TTS 생성 경로에서 캐시값을 사용
- **영향**:
  - 실전/연습 모드 전환이 UI/설정과 일치
  - 페르소나 기반 응답/음성 특성 일관성 확보

## 2026-01-11 — faster-whisper 호환성 수정

- **결정**: `WhisperModel.transcribe()` 인자 중 `logprob_threshold`는 faster-whisper 0.x에서 미지원이므로 제거한다.
- **근거**: 런타임에서 `unexpected keyword argument 'logprob_threshold'` 예외 발생, STT 파이프라인 중단
- **구현**: `services/stt/engine/whisper_stt.py`에서 인자 제거 후 이미지 재빌드 및 Kind 클러스터에 로드
- **영향**: STT gRPC 처리 안정화, 실시간 인식 흐름 정상화

## 2026-01-11 — Faster-Whisper STT 품질 개선 (한국어)

- **결정**: stt STT gRPC 서버의 Whisper 모델을 `base`에서 `small`로 상향하고, VAD 필터로 빈 결과가 나오는 경우 자동 폴백(무-VAD 재시도)을 추가한다.
- **근거**:
  - CPU int8 환경에서 `base` 모델은 짧은 발화/저음 환경에서 인식 실패 빈도가 높음
  - VAD 필터가 공격적으로 동작하는 입력(짧은 구간, 초기 무음)에서 `text_length=0`으로 종료
- **구현**:
  - [services/stt/supervisord.conf](services/stt/supervisord.conf) — `WHISPER_MODEL_SIZE="small"`
  - [services/stt/engine/whisper_stt.py](services/stt/engine/whisper_stt.py) — `vad_filter=True` 1차 시도, 빈 결과면 `vad_filter=False`로 재시도
- **운영 영향**:
  - 한국어 인식률 ↑, 빈 텍스트 반환 빈도 ↓
  - CPU 사용량은 유사(소형 모델 + int8), 지연은 소폭 증가할 수 있으나 UX 개선이 더 큼

- **결정**: 오디오 청크마다 gRPC 클라이언트 스트림을 생성/종료하는 방식에서, 인터뷰 세션당 단일 스트림을 유지하는 퍼시스턴트 패턴으로 전환
- **근거**: Fast Path(STT gRPC 직결)에서 "14 UNAVAILABLE: Connection dropped"가 반복 발생. per-chunk 스트림 생성/완료는 네트워크 변동과 서버 상태에 취약함
- **구현**:
  - [services/socket/src/events/events.gateway.ts](services/socket/src/events/events.gateway.ts)
    - `sttStreams` 맵(`interviewId`→`{subject, subscription}`) 도입
    - gRPC `speechToText` 구독은 인터뷰 시작 시 한 번만 수행
    - 오디오 청크는 `Subject.next()`로 전달하고, 마지막 청크에서만 `Subject.complete()` 호출
    - 에러/완료 시 맵에서 스트림 리소스를 정리하여 누수 방지
  - Kafka 발행 경로 및 Safe Path(Redis 큐잉) 로직은 기존 유지
- **영향**:
  - 스트림 끊김 감소 및 안정성 향상
  - 세션별 상태 관리 명확화, backpressure 대응 개선
  - 실시간 UX 체감 오류율 감소

## 2026-01-11 — 프론트엔드: 로컬 마이크 재생 기능

- **결정**: 브라우저 테스트 클라이언트에 녹음 종료 시점에서 전체 PCM16을 WAV로 조립해 즉시 재생하는 기능을 제공한다.
- **근거**:
  - STT로 서버 왕복하지 않고도 마이크 입력 품질(노이즈/게인/임계점)을 사용자 눈으로 빠르게 확인 가능
  - 현장 셋업(헤드셋/환경 소음) 튜닝 효율 향상
- **구현**:
  - [services/bff/test-client.html](services/bff/test-client.html)
    - 녹음 중 500ms 간격 PCM16 청크를 `lastRecordingPCMChunks`에 누적
    - `onstop`에서 전체 PCM16 병합 → `lastRecordingPCM` 저장
    - `createWavFromPCM16()`로 WAV Blob 생성 후 `playLastRecording()`로 재생
    - UI: `play-mic-local` 체크박스(기본 ON), 재생 버튼(마지막 녹음)
- **영향**:
  - STT 인식 실패 시 원인을 빠르게 파악(입력 레벨 부족, 임계점 과다 등)
  - 서버 부하 없는 로컬 품질 확인 루프 구축

## 2026-01-24 — Redis Sentinel on K8s 구현 검증 (정석 대비)

- **검증 기준**: [Redis 공식 Sentinel 문서](https://redis.io/docs/management/sentinel/), Bitnami/Helm 권장 패턴, K8s Downward API·이식성 관례.
- **정석과 일치하는 부분**:
  - **배치**: Redis 공식 "Example 2: basic setup with three boxes"와 동일 — 각 박스( Pod )에 **Redis + Sentinel 동시 실행**. 3 Sentinels, quorum 2.
  - **Config**: `min-replicas-to-write 1`, `min-replicas-max-lag 10`로 마이너리 파티션 시 쓰기 중단 제한 (공식 권장).
  - **DNS**: `resolve-hostnames yes`, `announce-hostnames yes`로 K8s/Docker 환경 호환 (공식 "IP Addresses and DNS names").
  - **설정 파일**: Sentinel은 설정 파일 **쓰기 필요** — `emptyDir` 기반 `/etc/redis` 사용으로 충족.
  - **동적 값**: Pod 이름·네임스페이스는 **Downward API** (`metadata.name`, `metadata.namespace`)로 주입. Ordinal·StatefulSet 이름은 `POD_NAME`에서 `sed`로 추출 (하드코딩 제거).
- **보완한 부분**:
  - **`sed -i` 이식성**: Alpine/BusyBox 등에서 `sed -i` 동작 차이 → **temp 파일** (`sed ... > tmp && mv tmp file`) 방식으로 통일.
  - **ConfigMap placeholder**: Master FQDN을 `REDIS_MASTER_FQDN` placeholder로 두고 Init Container에서 치환. ConfigMap 단독 실행은 불가, Init 필수.
- **선택적 차이**:
  - **Helm/Operator 미사용**: Bitnami Redis Helm·Redis Operator 대신 **순수 K8s 매니페스트** 사용. 운영 복잡도는 낮으나, 장애 시나리오·업스트림 패치 반영은 수동 관리.
- **구현**:
  - `k8s/infra/redis/common/configmap.yaml`: `master.conf` / `replica.conf` / `sentinel.conf` (placeholder 포함)
  - `k8s/infra/redis/local/redis-sentinel.yaml`, `prod/redis-statefulset.yaml`: Init Container에서 ordinal·FQDN 동적 생성, `sed` temp 파일 방식으로 sentinel.conf 치환.

---

## 2026-01-11 — Redis Sentinel 연결 안정화 (Socket)

- **결정**: Socket 서비스는 Sentinel 주소를 단일 호스트가 아닌 다중 호스트 리스트(3개 Pod의 Sentinel sidecar)로 주입하고, Sentinel 이름을 실제 클러스터 설정(`mymaster`)과 일치시킨다.
- **근거**: 단일 Sentinel FQDN(`redis-sentinel`)은 존재하지 않으며, ioredis가 모든 Sentinel에 도달하지 못해 `All sentinels are unreachable` 재시도가 발생했다. StatefulSet headless 서비스를 통해 각 Pod의 Sentinel(26379)에 직접 붙으면 DNS가 보장된다.
- **구현**:
  - `REDIS_SENTINEL_HOSTS`에 `redis-{0..2}.redis-headless...:26379` 리스트를 주입해 ioredis `sentinels` 배열로 전달
  - Sentinel 이름을 `mymaster`로 고정 (Sentinel 설정과 동일)
  - Safe Path/Redis Adapter 모두 동일 로직을 재사용하도록 정리

- **결정**: 필수 인프라(PostgreSQL, Redis, Kafka, NGINX Ingress) 및 필수 애플리케이션(llm, core, bff, socket, stt, tts, storage)은 에러 감지 기반 대기(`wait_for_pods_ready`)로 변경하고, 선택적 구성(모니터링, Inference)은 타임아웃 기반(`show_pod_status`)으로 유지
- **근거**:
  - 타임아웃 기반: 무한 대기는 매우 느리고 (300초 초과), 실제 에러가 무시되어 거짓 성공 발생 → 불완전한 배포 상태 초래
  - 에러 감지 기반: Pod 상태 즉시 모니터링 (ImagePullBackOff/CrashLoopBackOff 감지 시 즉시 배포 중단) → 빠른 실패로 빠른 수정
  - 진전 기반 대기: 이전 Ready count와 비교해 5회 연속 진전 없으면 배포 중단 → 매달려 있는 Pod 상태 빠르게 포기
- **구현**:
  - `wait_for_pods_ready()`: 최대 300회(~10분) 반복, 에러 감지 시 즉시 실패, 진전 없음 5회 시 배포 중단
  - `show_pod_status()`: 기존 타임아웃 기반 로직 유지, 선택적 서비스용으로 전환
  - 필수 요소 실패 시 `exit 1`으로 배포 즉시 중단
  - 선택적 요소 실패는 경고만 출력하고 배포 계속
- **영향**: 배포 신뢰성/속도/운영 편의성 ↑, 클러스터 안정성 ↑ (불완전한 배포 상태 방지)

## 2026-01-11 — STT/TTS/Storage Kafka 부트스트랩 통일

- **결정**: stt/tts/storage의 Kafka 부트스트랩 주소를 Socket과 동일하게 `kafka-cluster-kafka-bootstrap.kafka.svc.cluster.local:9092`로 통일한다.
- **근거**: 기본값 `kafka:29092`로 폴백되어 `NoBrokersAvailable`가 반복 발생했고, STT gRPC 스트림이 끊어졌다. 동일 부트스트랩 DNS를 사용하면 Pod 재시작 시에도 일관된 브로커 해상도가 보장된다.
- **구현**: `k8s/apps/stt/common/configmap.yaml`, `k8s/apps/tts/common/configmap.yaml`, `k8s/apps/storage/common/configmap.yaml`의 `KAFKA_BROKER` 값을 위 주소로 변경하고, 서비스별 `supervisord.conf`는 환경변수를 상속받도록 유지(하드코딩 제거).
- **영향**: STT/TTS/Storage Kafka 연결 안정화, STT fast-path 끊김 완화, 브로커 DNS 혼선 제거, 환경별 설정 유연성 향상.

## 2026-01-11 — Core Kafka/Redis 부트스트랩 안정화

- **결정**: Spring Boot 자동설정이 @KafkaListener용 Bean을 만들지 않아 `ConsumerFactory`와 `ConcurrentKafkaListenerContainerFactory`를 명시적으로 등록한다. ProducerFactory/KafkaTemplate도 함께 정의해 gRPC 기반 모듈 초기화 시 Bean 누락을 방지한다.
- **근거**: kafkaListenerContainerFactory 미정의로 Core Pod가 CrashLoopBackOff 발생. 명시적 Bean 생성으로 컨슈머 초기화 순서와 OnModuleInit 호출 시점을 보장.
- **결정**: Kubernetes 서비스 기본 env `REDIS_PORT=tcp://...` 충돌을 피하기 위해 `spring.data.redis.port` 바인딩을 `REDIS_PORT_NUMBER`/`REDIS_SERVICE_PORT`로 변경하고, Redis 호스트를 실제 서비스(`redis.unbrdn.svc.cluster.local`)로 교체한다.
- **근거**: 기존 `redis-master.infra...` FQDN과 tcp URL 포맷으로 인해 UnknownHostException 및 Actuator health 503 발생. 숫자 전용 포트 변수와 올바른 FQDN으로 헬스 체크를 안정화.

## 2026-01-11 — 실시간 면접 데이터 처리 전략 수립

### Hybrid Dual-Write 전략 (입력)

- **결정**: 오디오 입력을 Fast Path(gRPC Stream → STT Worker)와 Safe Path(Redis → Storage Worker → Object Storage)로 분리 처리하고, 클라이언트 ACK 기반 재전송 메커니즘 구현
- **근거**:
  - 실시간성: gRPC 직접 스트리밍으로 지연시간 최소화 (Kafka 우회)
  - 안전성: Redis 큐잉 + 비동기 아카이빙으로 데이터 유실 방지
  - 복원력: 네트워크/서버 장애 시 클라이언트 재전송으로 최후 보루 확보
- **구현**:
  - Socket 서비스에서 동시 처리 (병렬 Dual-Write)
  - Storage Worker는 storage로 분리 (supervisord 관리)
  - 클라이언트(브라우저)는 MediaRecorder로 청크 백업 + ACK 대기

### Streaming Pipeline 전략 (처리)

- **결정**: Core 서비스에서 LLM 토큰 스트리밍을 수신하고, 문장 부호(. ? !) 기준으로 버퍼링하여 Kafka(`BotQuestion`) 발행
- **근거**:
  - CPU 기반 LLM의 느린 추론 속도를 사용자에게 감추기 위한 설계
  - 문장 단위 조기 발행으로 TTS Worker가 먼저 오디오 생성 시작 → 체감 대기시간 < 1초
- **구현**:
  - Core: Spring Boot WebFlux 기반 리액티브 스트림 처리 + 지능형 버퍼
  - LLM: gRPC 양방향 스트리밍 (`GenerateResponse`)
  - TTS Worker: Kafka 구독 → Edge-TTS/OpenAI TTS → gRPC Stream → Socket.IO

### Async Backfill 전략 (복구)

- **결정**: Storage Worker가 파일 업로드 완료 시 Kafka 이벤트 발행 → Core가 실시간 STT 누락 구간을 배치 STT로 채워넣기
- **근거**:
  - 실시간 처리 실패(네트워크 끊김, Worker 장애)로 인한 데이터 공백 자동 복구
  - 최종 완결성 보장 (면접 전사 데이터 100% 확보)
- **구현**:
  - Storage Worker → Kafka `storage.completed` 이벤트
  - Core: 이벤트 수신 → DB 누락 구간 검색 → Object Storage에서 원본 다운로드 → 배치 STT → DB 업데이트

### 기술 스택 선정 근거

- **STT/TTS/Storage 분리**: 기능별 독립 서비스로 분리 → 장애 격리 + 리소스 스케일링 유연성
- **CQRS 패턴 (ATP/AJD)**: Command(실시간 쓰기)는 ATP(RDBMS), Query(조회)는 AJD(MongoDB 호환) → 쓰기/읽기 최적화
- **gRPC Stream + Kafka 혼합**: 초저지연(gRPC)과 느슨한 결합(Kafka)의 장점 결합

## 2026-01-10 — Inference/Triton 네이밍·배치 정책 갱신

- 오케스트레이션/비즈니스 로직은 `LLM` 서비스로 단일화 (STT/TTS/RAG)
- `Inference`는 NVIDIA Triton Inference Server 전용으로 정의하고, 모든 Kubernetes 매니페스트는 `k8s/apps/inference/*` 하위에 배치
- 네임스페이스도 `inference`로 분리하여 `unbrdn` 애플리케이션 워크로드와 명확히 구분
- 노드 스케줄링: `node-pool: triton` + `workload-type: triton` 라벨을 사용해 전용 노드에만 실행
- 기존 `k8s/apps/triton/*` 경로는 더 이상 사용하지 않으며, 레거시 파일에는 이동 안내 스텁만 유지

# Design Decisions (Summary)

이 파일은 최신 의사결정 요약을 유지합니다. 아카이브된 상세 원문은 `archive/docs/design-decisions.md`를 참고하세요.

## 2026-01-10 — Consolidation 업데이트

## 2026-01-10 — 로컬 Kind 노드 역할 확정

- 결정: Kind 로컬 클러스터는 Control Plane + App(2) + AI Worker + Inference(Triton) 5노드 구성으로 유지한다. App 노드에는 Kafka/Redis/BFF/Core/LLM/Monitoring에 더해 로컬 개발 시 Postgres를 함께 올릴 수 있다. AI Worker는 STT/TTS 전용이며 Kafka/Redis 백업만 허용한다. Inference는 Triton 전용 노드로 분리한다.
- 근거: 이벤트 기반 마이크로서비스 흐름을 로컬에서 HA 시나리오로 검증하고, AI 워크로드와 Triton을 분리해 리소스 경합을 줄인다. Postgres는 로컬 전용으로 App 노드에 공존해도 되지만, 프로덕션에서는 별도 관리형 DB를 사용한다.

## 2026-01-10 — Triton 전용 노드 라벨 사용 지침(로컬: `inference`)

- 결정: 로컬(kind) 환경에서는 전용 노드 라벨을 `node-pool: inference`, `workload-type: inference`로 사용한다. 프로덕션에서도 동일한 표기를 권장한다. 과거 문서의 `triton` 표기는 폐기한다.
- 근거: 레포의 매니페스트(k8s/apps/inference/\*)와 Kind 노드 라벨이 `inference`로 일치하며, 서비스/네임스페이스 명칭과 혼선을 줄인다.

## 2026-01-10 — 문서 폴더 슬림화

## 2026-01-10 — 레지스트리 명칭 정리 (LLM 단일)

- 결정: 레지스트리/환경변수는 서비스별 `REPO_*`를 사용한다 (`REPO_LLM`, `REPO_STT`, `REPO_TTS`, `REPO_STORAGE` 등). `inference`는 Triton GPU 모델 서빙 전용이며 기본 빌드/배포 대상이 아니다.
- 근거: 오케스트레이션 런타임을 LLM으로 명확히 분리하고 레거시 `REPO_INFERENCE` 의존을 제거해 혼선을 줄이기 위함.
- 영향: `.env`/`.env.example`에서 `REPO_INFERENCE`를 제거하고 서비스별 `REPO_*`만 유지. 빌드/배포 스크립트는 `services/llm`, `services/stt`, `services/tts`, `services/storage` 기준으로 동작하며, Triton은 향후 별도 경로로 추가.

## 2026-01-10 — LLM gRPC 프로토 리네임

- 결정: gRPC proto를 `llm.proto`/`LlmService`/package `llm`으로 통일하고 클라이언트 토큰을 `LLM_PACKAGE`로 사용한다. `LLM_GRPC_URL`을 기본 환경변수로 하고 `INFERENCE_GRPC_URL`은 호환 fallback만 허용.
- 근거: 서비스 명칭과 오케스트레이션 역할을 일관되게 유지하고 추후 Triton `inference`와 혼동을 제거.

## 2026-01-10 — LLM 용어·프로토 잔여 정리

- 결정: 오케스트레이션 경로(bff/socket/llm)에서는 레거시 `inference.proto`와 `inference-*` 로그 태그를 제거하고, 모든 표기를 LLM(`llm.proto`, `llm-grpc`, `llm-tts`, `llm-stt-whisper`)으로 통일한다. Triton `inference`는 별도 GPU 옵션임을 문서화(voice pipeline 가이드에 레거시 주석 추가)하고, k8s llm 매니페스트/시크릿 가이드는 LLM 용어만 사용한다.
- 근거: LLM 오케스트레이션과 Triton 모델서빙 경로를 명확히 구분해 운영 혼선을 방지하고, 잘못된 proto/로그 태그로 인한 추적 오류를 없애기 위함.


## 2026-01-24 — Core gRPC API 설계 원칙

### gRPC 메서드 네이밍 규칙

MSA와 DDD에서는 **"누가(Who) 요청했느냐"**보다 **"무엇을(What) 다루느냐"**가 로직의 위치를 결정합니다.

**gRPC 메서드는 행위(Verb) + 대상(Noun) 형태**를 사용합니다.

#### Auth 서비스
- `rpc SignUp(SignUpRequest) returns (SignUpResponse)`
- `rpc SignIn(SignInRequest) returns (SignInResponse)`
- `rpc SignOut(SignOutRequest) returns (Empty)`

#### User 서비스
- `rpc UpdateUser(UpdateUserRequest) returns (UserResponse)`

#### Resume 서비스
- `rpc UploadResume(UploadResumeRequest) returns (UploadResumeResponse)`

#### Interview 서비스
- `rpc StartInterview(StartInterviewRequest) returns (StartInterviewResponse)`

**주의사항:**
- `postInterview` 같은 이름은 gRPC 환경에서는 권장하지 않습니다.
- HTTP/REST API에서는 POST, GET, PATCH 같은 HTTP Method가 동작을 정의하지만, gRPC는 Remote Procedure Call(원격 프로시저 호출) 방식이기 때문에 "동사(Verb) + 명사(Resource)" 형태의 직관적인 함수명을 사용하는 것이 표준입니다.

**💡 Tip (Partial Update):** gRPC에서 PATCH 처럼 부분 수정만 하고 싶다면 `google.protobuf.FieldMask`를 사용하거나, 요청 DTO에 Optional 처리를 하여 값이 있는 필드만 업데이트하는 로직을 짭니다.

---

## 2026-01-24 — STT Service Refactoring: Pure gRPC & Architecture Improvements

- **결정**: STT 서비스에서 Multiprocessing(start.py)와 FastAPI(헬스체크용)를 제거하고,  단일 프로세스 실행 및 gRPC Native Health Check로 전환한다. 또한 의 이벤트 발행 로직을 로 분리한다.
- **근거**:
  - **복잡성 제거**: Multiprocessing 래퍼는 디버깅과 리소스 관리를 어렵게 함.
  - **표준 준수**: Kubernetes 환경에서 gRPC Native Probe가 권장됨.
  - **SRP 준수**: Worker 클래스가 비즈니스 로직(VAD, 엔진 호출)과 인프라 로직(Kafka/Redis 발행)을 동시에 담당하여 유지보수성 저하.
- **구현**:
  - **엔트리포인트**:  ->  (단일 gRPC 프로세스)
  - **헬스 체크**:  라이브러리 도입, K8s Probe를  모드로 변경 ()
  - **Publisher 분리**:  생성,  클래스가 모든 외부 이벤트 발행 담당
- **Redis 키 구조 검증**:
  - 현재  (채널) 및  (스트림) 키 구조는 아키텍처적으로 적절함을 재확인.
  - 중앙 에서 관리되며 환경 변수로 유연성을 확보.
- **영향**:
  - STT 서비스 구조 단순화 및 안정성 향상.
  - 8000번 포트 제거로 보안/네트워크 설정 간소화.
  - 코드 가독성 및 테스트 용이성 개선.
