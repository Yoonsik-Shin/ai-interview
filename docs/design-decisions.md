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

---

## 8. Redis Configuration: StringRedisTemplate 빈 수동 등록 (2026-03-27)

### 배경

`interview` 서비스 배포 시 `RedisCacheAdapter`에서 `StringRedisTemplate` 빈을 찾지 못해 `APPLICATION FAILED TO START` 에러와 함께 `CrashLoopBackOff` 현상이 발생했습니다.

### 원인 분석

1. **커스텀 Redis 설정**: `InterviewRedisConfig`에서 `RedisConnectionFactory`와 `RedisTemplate<String, Object>`를 직접 `@Bean`으로 등록했습니다.
2. **자동 설정 비활성화**: Spring Boot의 Redis 자동 설정(`RedisAutoConfiguration`)은 사용자가 `RedisConnectionFactory`나 `RedisTemplate` 빈을 직접 정의하면 활성화되지 않거나, `StringRedisTemplate`을 자동으로 생성해주지 않는 경우가 발생합니다.
3. **의존성 주입 실패**: `RedisCacheAdapter`는 `StringRedisTemplate`을 생성자 주입으로 요구하고 있었으나, 컨텍스트에 해당 타입의 빈이 존재하지 않았습니다.

### 결정 사항

- **StringRedisTemplate 빈 명시적 등록**: `InterviewRedisConfig`에 `track1ConnectionFactory`를 사용하는 `StringRedisTemplate` 빈을 직접 등록합니다.
- **Track 1 우선순위**: `interview` 서비스에서 토큰 버퍼링 및 LLM 응답 캐싱은 실시간성이 중요한 Track 1(Redis)을 사용하므로, 해당 연결 팩토리를 주입받도록 설정합니다.

### 기대 효과

- `interview` 서비스의 정상적인 애플리케이션 시작 및 Redis 기능 활용이 가능해집니다.

---

## 9. Lombok 어노테이션 사용 및 임포트 표준화 (2026-03-27)

### 배경

`ProcessLlmTokenInteractor.java` 리팩토링 과정에서 `@RequiredArgsConstructor` 어노테이션은 사용되었으나 해당 임포트 문이 누락되어 전체 빌드가 실패하는 문제가 발생했습니다. `Spotless`나 IDE 설정에 따라 미사용 임포트가 제거되거나 누락된 임포트가 자동으로 추가되지 않을 수 있는 환경을 고려해야 합니다.

### 결정 사항

- **임포트 명시적 확인**: Lombok 어노테이션 사용 시 반드시 해당 패키지의 임포트(`import lombok.*;`)가 포함되어 있는지 확인합니다.
- **Spotless 활용**: 빌드 전 `./gradlew spotlessApply`를 실행하여 포맷팅 및 임포트 정리를 자동화합니다.
- **CI 검증 강화**: 빌드 파이프라인에서 컴파일 에러를 조기에 발견할 수 있도록 에러 로그 모니터링을 강화합니다.

### 기대 효과

- 단순 임포트 누락으로 인한 빌드 실패 및 배포 지연을 방지합니다.
- 코드의 일관성과 품질을 유지합니다.

## 10. 면접 일시정지(Pause) 성능 최적화 및 상태 제어 강화 (2026-03-27)

### 배경

면접 중 "일시정지" 또는 "나가기" 시 DB 연결 타임아웃 및 영상 세그먼트 업로드 요청 폭주로 인한 시스템 불안정 현상이 발생했습니다.

### 원인 분석

1. **트랜잭션 지연**: `PauseInterviewInteractor`에서 카프카 이벤트 발행이 트랜잭션 내부에서 발생하여 DB 커넥션 점유 시간이 길어짐.
2. **클라이언트 요청 지속**: 일시정지 처리 중에도 프론트엔드에서 영상 녹화 및 업로드 요청이 계속 발생하여 백엔드 부하 가중.

### 결정 사항

- **이벤트 발행 분리**: `PauseInterviewInteractor`에서 `publishInterviewPaused`를 `@Transactional` 외부로 이동하여 DB 트랜잭션 시간을 최소화함.
- **백엔드 가드 강화**: `PAUSED` 상태의 세션에 대한 영상 업로드 관련 요청(`GetUploadUrl`, `CompleteUpload`)을 인터랙터 레벨에서 즉시 차단함.
- **프론트엔드 즉시 제어**: 일시정지 진입 시 `isPausing` 상태를 도입하여 추가 녹화 시작을 막고, `mediaRecorder.stop()`을 즉시 호출하여 데이터 생성을 차단함.

### 기대 효과

- 일시정지 시 DB 부하 및 네트워크 트래픽 급감.
- 상태 전이의 안정성 및 시스템 반응 속도 향상.

## 11. 인터뷰 로그 출력 최적화 및 로깅 전략 수립 (2026-03-27)

### 배경

실시간 음성 면접 특성상 초당 수차례 발생하는 LLM 토큰 수신 및 Redis Pub/Sub 로그가 터미널을 점유하여, 정작 중요한 에러 로그나 상태 변화를 파악하기 어려운 문제가 발생했습니다.

### 결정 사항

- **빈도 기반 로그 레벨 차등화**: 1초 이내에 반복적으로 발생하는 로그(토큰 수신, 스트리밍 상태 등)는 `DEBUG` 또는 `VERBOSE` 레벨로 조정합니다.
- **표준 로거 사용 강제**: `System.out.println` 대신 SLF4J(Lombok `@Slf4j`) 또는 NestJS `Logger`를 사용하여 런타임에 로그 레벨 제어가 가능하도록 합니다.
- **인프라 로그 노출 최소화**: TTS/LLM 엔진의 intermediate JSON 로그는 개발 단계에서만 활성화하고 운영/통합 스테이지에서는 비활성화(주석 처리)합니다.

### 기대 효과

- 터미널 가독성 향상으로 인한 이슈 대응 속도 개선.
- 불필요한 IO 부하 감소로 인한 서비스 성능 미세 향상.
- 로그 파이프라인(CloudWatch 등) 비용 절감.

---

## ---
12. Redis Track 1 DB Index 0으로 통일 (2026-03-27)

### 배경

서비스별로 Redis Track 1(실시간 파이프라인)의 DB 인덱스가 파편화되어 있어(DB 0, 1, 2 등), 데이터 유실 및 메시지 수취 실패 문제가 발생할 가능성이 높었습니다.

### 결정 사항

- **DB 0 강제 통일**: 모든 마이크로서비스(Java, Node.js, Python)의 Redis Track 1 연결 시 기본 DB 인덱스를 `0`으로 고정합니다.
- **기본값 수정**: `application.properties` 및 Python `config.py` 내의 `REDIS_DB` 기본값을 `0`으로 상향 조정하여 설정 누락 시에도 DB 0을 사용하도록 합니다.
- **환경 변수 동기화**: K8s ConfigMap에서도 `REDIS_DB: "0"`으로 일관성 있게 관리합니다.

### 기대 효과

- 서비스 간 Redis Pub/Sub 및 Streams 데이터 정합성 확보.
- 설정 오류로 인한 통신 단절 방지 및 유지보수 편의성 증대.

---

## 13. 로컬 환경(Mac) 하드웨어 가속 (MPS) 도입 (2026-03-27)

### 도입 배경

로컬 개발 환경(Mac Apple Silicon)에서 문서 임베딩 및 STT 처리 속도를 향상시키기 위해 GPU 가속 사용 여부를 검토함.

### 결정 사항 (MPS)

- **Document 서비스**: PyTorch의 `mps` 기기를 활용하도록 수정. `sentence-transformers` 라이브러리가 PyTorch 기반이므로 `device='mps'` 설정을 통해 GPU 가속이 가능함.
- **STT 서비스**: 현재 사용 중인 `faster-whisper` (CTranslate2) 라이브러리는 `mps`를 지원하지 않음(CPU/CUDA만 지원). 따라서 STT는 기존처럼 최적화된 CPU 모드를 유지함.
- **동적 디바이스 선택**: 코드를 수정하여 `torch.backends.mps.is_available()`인 경우 `mps`를 사용하고, 그렇지 않으면 `cpu`로 폴백하도록 구현함.

### 도입 기대 효과

- Mac 환경에서 문서 분석 및 검색 시 임베딩 생성 속도 향상.
- 환경에 구애받지 않는 (Cross-platform) 유연한 디바이스 선택 로직 확보.

---

## 14. 채용 공고 URL 및 자기소개 텍스트의 gRPC 기반 컨텍스트 전달 (2026-03-27)

### 배경

이전 결정(#14 초기 버전)에서 제안된 '공유 Redis 기반 상태 조회' 방식은 Core(Java) 서비스의 내부 데이터 구조를 LLM(Python) 서비스가 직접 들여다보게 함으로써 MSA의 핵심 원칙인 **데이터 주권(Data Sovereignty)**을 침해하고 서비스 간 강한 결합을 유발하는 안티패턴임이 확인되었습니다.

### 결정 사항 (MSA 원칙 준수)

- **공유 Redis 접근 폐지**: LLM 서비스(`engine/nodes.py`)에서 Core 서비스의 Redis 키(`interview:{id}:state`)를 직접 조회(`hget`)하던 로직을 완전히 삭제했습니다.
- **gRPC 명시적 전달 (Push/Caching)**: 
    - `GenerateRequest`에 `job_posting_url`과 `self_intro_text` 필드를 추가했습니다.
    - Core 서비스는 면접 시작 시 또는 정보가 업데이트된 시점에만 해당 필드를 채워서 전달하며, LLM은 이를 수신하여 자신의 **LangGraph State(Track 2)**에 저장합니다.
    - 이후 턴에서는 LLM이 자신의 로컬 체크포인트에서 데이터를 꺼내 사용함으로써 매번 중복 전달되는 오버헤드를 방지합니다.

### 아키텍처적 이점

- **서비스 독립성**: Core와 LLM 간의 인터페이스가 gRPC로 명확히 정의되어 데이터 구조 변경 시 상호 영향이 최소화됩니다.
- **보안 및 격리**: 각 서비스는 자신이 소유한 DB/Redis 키 공간만 관리하며, 외부 서비스에 내부 저장소 접근권을 노출하지 않습니다.

## 15. 서비스별 Redis 키 프리픽스 격리 및 표준화 (2026-03-27)

### 결정 사항

서비스 간 데이터 간섭을 방지하고 책임 소재를 명확히 하기 위해 Redis 키 프리픽스를 다음과 같이 격리하여 표준화했습니다.

- **Core (Java/Spring)**: `interview:session:hash:{id}` (비즈니스 세션 상태 독점 관리)
- **LLM (Python/LangGraph)**: `checkpoint:{thread_id}` (LangGraph 자체 체크포인트, Track 2)
- **Socket (Node.js/Nest)**: `interview:rt:{id}` (실시간 타이빙 임시 캐시), `interview:session:{id}` (소켓 연결 추적)

### 기대 효과

- 의도치 않은 데이터 덮어쓰기 방지 및 디버깅 시 데이터 출처의 명확성 확보.

## 16. 단계별 동적 VAD(Voice Activity Detection) 정책 (2026-03-28)

### 배경

일률적인 VAD 침묵 임계값(1.5초) 적용 시, 자기소개와 같이 긴 호흡이 필요한 단계에서 사용자가 잠시 생각하는 중에도 턴이 강제로 종료되는 문제가 발생했습니다.

### 결정 사항

- **차등적 임계값 적용**: 스테이지의 성격에 따라 VAD 종료 판정 기준을 다르게 설정합니다.
    - `SELF_INTRO` (자기소개): **5.0초** (충분한 생각 시간 제공)
    - `일반 Q&A`: **1.5초** (빠른 대화 흐름 유지)
- **구현 방식**: Python STT 서비스(`audio_request_worker.py`)에서 gRPC 요청의 `stage` 메타데이터를 확인하여 `VadEngine`의 `min_silence_ms`를 동적으로 조정합니다.

### 기대 효과

- 사용자 경험(UX) 개선: 자기소개 중 의도치 않은 턴 종료 방지.
- 시스템 유연성: 향후 압박 면접(짧은 VAD) 등 다양한 시나리오 대응 가능.

## 17. 실시간 면접의 하드 타임아웃(Hard Timeout) 도입 (2026-03-28)

### 배경

VAD는 침묵을 기준으로 턴을 종료하므로, 사용자가 끊임없이 말을 이어갈 경우 시스템이 무한히 대기하거나 프론트엔드 타이머와 어긋나는 현상이 발생할 수 있습니다.

### 결정 사항

- **이중 타임아웃 구조**:
    - **인프라 레벨 (STT)**: 단일 오디오 스트리밍 세션에 대해 **90초 하드 제한**을 설정합니다. 90초 초과 시 VAD 상태와 관계없이 루프를 탈출하고 현재까지의 텍스트를 반환합니다.
    - **백엔드 레벨 (Core)**: `ProcessUserAnswerInteractor`에서 `SELF_INTRO` 경과

### #25. 인터뷰 흐름 미세 조정 및 레이스 컨디션 방지
- **배경**: 
  - `CANDIDATE_GREETING` 단계의 VAD(400ms)가 너무 짧아 사용자 편의성이 저하됨.
  - 리트라이 이벤트와 서버의 TurnState 이벤트가 동시에 프론트에 도착하여 녹음(`startRecording`)이 중복 호출되는 레이스 컨디션 발생.
  - 스테이지 전이와 첫 토큰 수신 사이의 선후 관계가 꼬여 인터뷰가 멈추는 현상(Stuck) 보고됨.
- **결정 사항**:
  - **VAD 감도 완화**: 인사 단계 `redemptionMs`를 **1000ms**로 상향 조정.
  - **상태 기반 녹음 시작 단일화**: `playNextTts` 및 `setOnRetryAnswer`에서 직접 `startRecording`을 호출하던 로직을 제거하고, 리액티브한 `useEffect` 한 곳에서만 상태(`!ttsPlaying`, `LISTENING`)를 보고 녹음을 시작하도록 통합.
  - **중복 처리 가드**: 백엔드(`ProcessUserAnswerInteractor`)에서 2초 이내의 동일 세션 리트라이 요청은 중복으로 간주하여 무시.
  - **스테이지 가드 로직 보강**: 프론트엔드 `setOnStageChanged` 시 이미 LLM 토큰 수신이 시작된 경우(`pendingAiPlaybackRef.current === true`) 전이 가드(`pendingFirstQuestionRef`)를 설정하지 않음으로써 레이스 컨디션에 의한 "Stuck" 현상 방지.
- **영향**: 리트라이 과정의 음성 겹침 및 녹음 중복 현상 해결, 인터뷰 흐름의 시각적/청각적 안정성 확보.

---

## 18. 역할(Role) 중심 오디오 자산 구조화 및 TTS 튜닝 (2026-03-28)

### 배경

기존 오디오 자산은 성향(Personality: COMFORTABLE, PRESSURE 등) 기반으로 관리되어 다수의 면접관이 참여하는 상황에서 목소리 식별이 어렵고, `PRESSURE`, `RANDOM` 등 사용되지 않는 레거시 설정이 혼재되어 있었습니다. 또한 4가지 면접관 역할(`MAIN`, `HR`, `TECH`, `EXEC`) 간의 목소리 차별화가 부족했습니다.

### 결정 사항

- **역할 기반 폴더 구조 도입**: `/public/audio/{ROLE}/{CATEGORY}/` 구조로 자산을 전면 재배치하여 면접관 독립적인 오디오 공간을 확보함.
- **Edge TTS 동적 파라미터 활용**: 별도의 유료 TTS 엔진 도입 없이, `Edge TTS`의 속도(`rate`)와 피치(`pitch`) 조절 기능을 엔진에 통합하여 역할별 고유한 목소리 프로필을 생성함.
    - `MAIN`: 표준
    - `HR`: 경쾌하고 높은 톤 (+10% rate, +5Hz pitch)
    - `TECH`: 중후하고 신중한 톤 (Hyunsu, -5% rate, -2Hz pitch)
    - `EXEC`: 차분하고 전문적인 톤 (InJoon, +0% rate, +0Hz pitch)
- **레거시 제거**: 시스템 전반에서 `PRESSURE`, `RANDOM` 관련 코드, 프롬프트, 오디오 파일을 삭제하고 `COMFORTABLE`을 기본 성향으로 단일화함.

### 기대 효과

- **사용자 경험(UX)**: 면접관별로 명확히 구분되는 목소리를 통해 실제 대면 면접과 유사한 몰입감 제공.
- **유지보수성**: 역할 중심의 자산 관리를 통해 신규 면접관 추가나 목소리 변경 시 영향도 최소화.

---

## 19. AI 면접 지연 안내(Filler Voice) 및 유휴 타이머 최적화 전략 (2026-03-29)

### 배경

사용자가 답변을 마친 후 AI 답변이 생성되는 동안 발생하는 "잠시만요" 안내 음성(Filler)과 10초 무발화 시 나오는 유휴 안내가 면접의 긴장감을 저해하고 사용자 피로감을 유발함. 특히 1~2초의 자연스러운 답변 대기 시간조차 '지연'으로 판단하여 시스템이 개입하는 현상을 해결해야 함.

### 결정 사항

1. **프론트엔드 유휴 타이머의 보수적 운영**: 
    - 임계값을 10초에서 **60초**로 상향하여, 지원자가 긴 생각 후 답변하거나 AI의 답변 생성이 길어지는 상황을 충분히 수용함.
    - AI가 연산 중(`THINKING`)이거나 발화 중(`SPEAKING`)일 때, 그리고 사용자가 발화 중(`isUserSpeaking`)일 때는 타이머를 정지시켜 '가짜 유휴(False Inactivity)' 안내를 원천 차단함.
2. **자동 필러(Filler) 신호의 소켓 관문 차단**:
    - 백엔드(LLM/Core)에서 발생하는 모든 `INTERVENE`(개입) 신호를 소켓 게이트웨이(BFF) 레이어(`SendTranscriptUseCase`)에서 차단하는 '선별적 침묵' 전략을 채택함. 
    - 이는 백엔드의 복잡한 워치독(Watchdog) 로직을 수정하여 예기치 못한 부작용을 유발하는 대신, 클라이언트로 나가는 최후의 관문에서 사용자 경험을 직접적으로 관리하는 가장 효율적이고 안전한 방식임.
3. **예외 케이스(Retry/Manual) 보존**:
    - 자기소개 인식 실패 시의 리트라이(`RETRY_ANSWER`) 로직은 `INTERVENE`과 다른 별도의 타입으로 처리되므로 그대로 유지하여 기능성을 확보함.
    - 수동 "건너뛰기" 기능은 게이트웨이 내부에서 직접 발행되므로 영향 없이 정상 작동함.

### 기대 효과

- **면접 몰입도 향상**: 불필요한 시스템 개입 없이 실제 면접과 유사한 정적인 대기 환경을 제공함.
- **시스템 안정성**: 백엔드 로직 수정 최소화를 통해 기존 스테이지 전이 로직의 정합성을 유지하면서 UI/UX만 효과적으로 개선함.
- **비용 최적화**: 단일 무료 TTS 엔진(Edge TTS)의 파라미터 튜닝만으로 풍부한 목소리 다양성 확보.
## 20. 인터뷰 스테이지 전이 로직의 안정성 강화 (2026-03-29)

### 배경

`INTERVENE` 신호 차단 등 인터뷰 흐름 최적화 과정에서 `TransitionInterviewStageInteractor.java`의 로깅 코드가 수정되었으나, 변수 정의(`interviewId`) 누락으로 인해 전체 서비스 빌드가 실패하는 컴파일 오류가 발생했습니다.

### 결정 사항

- **세션 ID 명시적 정의**: 모든 인터랙터(Interactor) 내의 로깅 및 스테이지 전이 로직에서 `session.getId().toString()`을 로컬 변수 `interviewId`로 명시적으로 정의하여 사용함으로써 코드 가독성을 높이고 런타임/컴파일 오류를 방지합니다.
- **빌드 검증 프로세스 준수**: 소스 코드 수정 후에는 반드시 `./gradlew compileJava` 또는 `bootJar`를 실행하여 컴파일 오류가 없는지 최종 확인합니다.

### 기대 효과

- 단순 오타나 변수 누락으로 인한 배포 중단 방지.
- 로깅 메시지의 일관성 확보.

## 21. 스테이지 전이 시 마이크 강제 제어 및 상태 동기화 (2026-03-29)

### 배경

면접 진행 중 스테이지가 전환(예: 지원자 인사 → 면접관 자기소개)됨에도 불구하고 프론트엔드에서 마이크 녹음 상태가 유지되어, 면접관이 말하는 동안 지원자 박스에 초록색 하이라이트가 생기거나 불필요한 음성 데이터가 서버로 전송되는 문제가 발생했습니다. 또한 자기소개 리트라이 시 안내 음성 재생과 녹음 재개 시점의 동기화가 맞지 않는 문제가 있었습니다.

### 결정 사항

1. **명시적 녹음 중단 (Explicit Stop)**: `setOnStageChanged` 콜백 내에서 새로운 스테이지가 답변 가능 단계(`CANDIDATE_GREETING`, `SELF_INTRO`, `IN_PROGRESS`, `LAST_ANSWER`)가 아닐 경우, 즉시 `stopRecording()`을 호출하여 마이크를 끄고 UI 하이라이트를 초기화합니다.
2. **TTS 재생 상태의 State화**: 안내 음성 재생 상태를 `Ref`에서 `State`(`ttsPlaying`)로 전환하여, `useEffect`가 TTS 종료 시점을 감지하고 `canCandidateSpeak` 환경에 맞춰 즉시 녹음을 재개할 수 있도록 반응형 로직을 구축했습니다.
3. **인사 단계 전이 가드 완화**: `ProcessUserAnswerInteractor`에서 인사 단계 수신 시 텍스트 내용의 유무와 상관없이 즉시 다음 단계(면접관 소개)로 전이하도록 로직을 수정하여, STT 지연으로 인한 "Hanging" 현상을 방지합니다.

### 기대 효과

- **UI 정합성**: 면접관 턴에서 소음으로 인한 지원자 하이라이트 노출 원천 차단.
- **사용자 경험(UX)**: 리트라이- [v] 인터뷰 흐름 안정화: VAD 감도 조정(1000ms), 리트라이 레이스 컨디션 해결, 중복 녹음 시작 방지 로직 적용
- [v] 자기소개 리트라이 가드: 동일 세션 내 2초 이내 중복 리트라이 방지 로직 적용
상향 (2026-03-29)

### 배경

자기소개 단계에서 사용자가 발화를 마쳤음을 인식하는 VAD(Voice Activity Detection) 대기 시간이 과도하게 길어(5초), 사용자가 답답함을 느끼는 문제가 있었습니다. 또한, VAD 대기 시간으로 인해 실제 발화 시간은 30초 미만임에도 서버에는 30초를 초과한 것으로 인식되어 리트라이 로직(`RETRY_ANSWER`)이 작동하지 않고 다음 단계로 넘어가는 부작용이 발생했습니다.

### 결정 사항

1. **VAD 무음 임계값 단축**: `SELF_INTRO` 단계의 무음 인지 시간을 5,000ms에서 **3,000ms**로 단축하여 발화 종료 후 대기 시간을 줄였습니다.
2. **리트라이 판정 시간 상향**: `ProcessUserAnswerInteractor`의 리트라이 판정 기준을 30초에서 **35초**로 상향 조정했습니다. 이는 단축된 VAD 대기 시간(3초)을 포함하더라도 실제 발화가 30초 내외인 경우 리트라이 기회를 보장하기 위함입니다.

### 기대 효과

- **사용자 경험(UX)**: 발화 종료 후 다음 단계로의 전환 속도가 체감될 정도로 빨라짐.
- **로직의 일관성**: VAD 지연으로 인한 리트라이 기능 무력화 현상을 방지하여 시스템의 의도된 동작을 보장.

## 22. 자기소개 리트라이 정책 및 레이스 컨디션 근본 해결 (2026-03-29)

### 배경
- 자기소개 단계에서 발화 지연 시 제공되는 리트라이 기회가 무한히 반복되거나, 프론트/백엔드 간의 레이스 컨디션으로 인해 음성이 중복 재생되는 문제 발생.
- 리트라이 3회차 시도 시에도 실패할 경우 적극적인 개입(`intervene_intro_edge.mp3`)을 통해 자연스럽게 본 면접으로 유도하는 기획 의도 실현 필요.

### 결정 사항
1. **리트라이 횟수 엄격 제한**: 초기 1회 + 리트라이 2회(총 3회 시도)로 공식 제한. 3회차 시도마저 실패 시 `intervene_intro_edge.mp3` 재생과 함께 즉시 본 면접(`IN_PROGRESS`)으로 강제 전이.
2. **레이스 컨디션 차단 (Backend)**: `InterviewSessionState`에 `lastRetryAt` 외에 **`lastStageTransitionAt`** 필드를 신설하여, 단계 전례(`STAGE_CHANGE`) 직후 3초 이내에 도착하는 이전 단계의 잔여 발화 데이터(Residue)를 무시하는 가드 로직을 도입했습니다. 이를 통해 `turnCount`가 1에서 2로 비정상적으로 증가하는 현상을 근본적으로 해결했습니다.
3.  **리트라이 타이머 동기화 (Frontend)**: 리트라이 이벤트(`RETRY_ANSWER`) 수신 시 프론트엔드 UI 타이머(`elapsedSeconds`)를 즉시 0으로 초기화하여 백엔드 측정 시간과 일치시키고 사용자 경험의 혼란을 방지했습니다. 또한 프론트엔드 자체의 VAD 기반 수동 리트라이 판단 로직을 제거하고 백엔드의 판단으로 로직을 일원화했습니다.
4.  **무응답 타이머 동기화**: 면접관의 능동적인 개입을 위해 무응답 안내(`wait_edge.mp3`) 타이머를 10초로 동기화하여 사용자 긴장감 유지 및 흐름 정체 방지.

### 기대 효과
- 리트라이 루프 정체 현상 완벽 방지 및 안정적인 면접 시작 흐름 보장.
- 분산 환경에서의 상태 불일치 및 중복 요청 이슈 해결.

- **Atomic state reset**: `RetrySelfIntro` 호출 시 Redis의 `selfIntroStart`, `lastRetryAt`을 현재 시간으로 동기화하여 UI 타이머가 렉 없이 `00:00`으로 복구되도록 보장.

---

## 23. 인터뷰 메시지 저장 경로 이원화 및 Turn 0 정적 메시지 직접 저장 (2026-03-30)

### 배경

`CoreDbSaverWorker`에서 텍스트 기반으로 시스템 안내 메시지를 필터링하던 로직이 데이터 유실과 로직 복잡도를 유발했습니다. 특히 자기소개(Turn 0) 단계의 리트라이 안내 및 전환 멘트가 DB에 누락되어 면접 히스토리의 정합성이 깨지는 문제가 있었습니다.

### 결정 사항

1.  **저장 경로 분리**: 
    - **Direct Path (정적 메시지)**: 백엔드 내부에 미리 정의된 안내 문구(리트라이 요청, 단계 전환 멘트 등)는 `ProcessUserAnswerInteractor` 및 `RetrySelfIntroInteractor`에서 DB에 즉시 직접 저장합니다.
    - **Stream Path (동적 메시지)**: LLM이 실시간으로 생성하는 질문 및 답변은 기존처럼 Redis Stream을 거쳐 `CoreDbSaverWorker`에서 비동기적으로 저장합니다.
2.  **필터링 로직 현대화**: `CoreDbSaverWorker`의 취약한 텍스트 기반 필터링("시간 관계상" 등 검색)을 제거하고, `InterviewMessagePersistencePolicy`를 주입받아 Stage와 Role 기반으로 저장 여부를 결정하도록 개선했습니다.
3.  **Turn 0 저장 규격화**: 자기소개 단계(Turn 0)의 사용자 발화 및 AI 메시지를 기획된 시퀀스(`sequence_number` 0~2)에 맞춰 정교하게 기록합니다.

### 기대 효과

- **데이터 무결성**: 모든 면접 단계의 핵심 발화가 누락 없이 기록되어 완벽한 면접 복기가 가능해집니다.
- **시스템 안정성**: 필터링 오류로 인한 오동작을 방지하고, 서비스 간 권한과 책임을 명확히 분리하여 결합도를 낮췄습니다.

---

## 24. AI 발화 지연 가드(pendingAiPlayback)의 반응형 상태 전환 (2026-03-30)

### 배경

AI의 안내 음성(리트라이 안내 등)이 종료된 후, 약 1.5초의 자연스러운 대기 시간(`turnEndDelay`)을 가진 뒤 녹음을 재개하도록 설계되어 있습니다. 하지만 이 가드 변수가 `Ref`로 관리되면서, 비동기 타이머가 종료되어 가드가 해제되어도 리액트의 `useEffect`가 이를 인지하지 못해 면접이 `IDLE` 상태에서 멈추는 교착 상태가 발생했습니다.

### 결정 사항

- **Ref -> State 전환**: `pendingAiPlayback`을 `useRef`에서 `useState`로 전환했습니다.
- **반응형 녹음 재개**: 음성 재생 종료 1.5초 후 `setPendingAiPlayback(false)`가 호출되면, 이를 의존성으로 가진 녹음 시작 `useEffect`가 즉각적으로 재실행됩니다. 이때 모든 조건(ttsPlaying=false, canCandidateSpeak=true)이 충족되므로 안전하고 확실하게 녹음 환경(`LISTENING`)으로 복구됩니다.
- **백엔드 권한 동기화**: 서버의 `Status`(SPEAKING, LISTENING 등)와 발화 권한(`canCandidateSpeak`)이 항상 일치하도록 백엔드 인터랙터 로직을 전면 수정하여 프론트엔드의 판단 근거를 명확히 했습니다.

### 기대 효과

- **시스템 안정성**: 네트워크 지연이나 비동기 타이머의 선후 관계에 상관없이 AI 발화 종료 후 확실한 서비스 복구 보장.
- **사용자 경험(UX)**: 리트라이나 면접관 소개 후 "먹통" 현상 없이 매끄러운 진행 가능.

## 25. 실효 상태(Effective State) 및 Stale Closure 해결 (2026-03-30)

### 배경

리트라이 발생 시 `PROCESSING` 상태가 되었다가 곧바로 `IDLE`로 변하며 면접이 먹통이 되는 현상이 지속적으로 발생했습니다. 또한 AI 발화 중에도 `Listening...`이 뜨는 UI 정합성 문제가 발견되었습니다.

### 근본 원인: Stale Closure & UI Sync failure

1.  **Stale Closure**: `playNextTts` 내부의 `setTimeout`이 예약 시점의 `pendingAiPlayback` (false) 값을 캡처하여, 오디오 재생 중에 종료 핸들러가 실행되면서 상태를 강제로 `IDLE`로 덮어씌웠습니다.
2.  **UI/Backend Desync**: 클라이언트 UI가 서버 상태(`conversationState`)만 의존하여, 로컬에서 오디오가 재생 중임에도 서버가 보낸 `LISTENING`을 그대로 표시했습니다.

### 최종 해결책

-   **Effective State 도입**: `effectiveStatus`를 통해 UI의 모든 판단(라벨, 글로우, 입력 차단)이 실효 상태를 따르도록 단일화했습니다.
-   **Ref 기반 동적 참조**: 스케줄러 내부에서 `pendingAiPlaybackRef.current`를 참조하여 최신 인터벤션 상태를 확인하도록 수정했습니다.
-   **Intervention Lock 강화**: 소켓 핸들러에서 AI 발화 중에는 서버의 특정 상태 업데이트를 무시하는 인터벤션 락을 정밀하게 적용했습니다.
-   **백엔드 원자성 확보**: 리트라이 시 발화 권한(`canCandidateSpeak`)을 명시적으로 관리하여 상태 불일치를 차단했습니다.

---

## 26. 자기소개 리트라이 시 실시간 상태 동기화 및 지연 데이터(Residue) 처리 개선 (2026-03-30)

### 배경

자기소개 리트라이 시 이전 시도의 지연된 STT 결과(Residue)가 도착할 때, 백엔드에서 전송하는 `turn_state` 메시지가 로컬 객체의 오래된 상태(`COMPLETED`)를 포함하여 프론트엔드를 `IDLE`로 강제 전이시키는 레이스 컨디션 발생.

### 결정 사항

1. **로컬 상태 동기화 강제 (Core)**: `ProcessUserAnswerInteractor`에서 지연 데이터(Residue)를 무시할 때, Redis 상태뿐만 아니라 메모리 상의 `state` 객체 상태도 `LISTENING`으로 즉시 동기화한 후 발행하도록 수정.
2. **프론트엔드 방어 가드 강화 (Frontend)**: `Interview.tsx`의 `onTurnState` 핸들러에서 `SELF_INTRO` 단계이고 타이머(`timeLeft`)가 작동 중인 경우, 서버에서 오는 `COMPLETED` 신호를 지연된 노이즈로 간주하고 무시함.
3. **상태 업데이트 가드 제거 (Frontend)**: `setOnTurnState` 핸들러에서 안내 음성(`pendingAiPlayback`) 중에도 백그라운드 상태 업데이트를 허용하여 오디오 종료 시 즉시 정상 상태로 복구되도록 함.
4. **리트라이 정합성 (Core)**: `RetrySelfIntroInteractor` 및 `ProcessUserAnswerInteractor`에서 리트라이 성공 시 `canCandidateSpeak: true` 설정 및 명시적 `turn_state` 이벤트 발행 보장.

### 기대 효과

- **시스템 원자성**: 백엔드의 Redis 상태와 메모리 객체 간의 불일치를 해결하여 잘못된 정보 전송 차단.
- **UI 견고성**: 서버에서 예기치 않게 도착할 수 있는 지연된 완료 신호로부터 UI 상태를 이중으로 보호.
