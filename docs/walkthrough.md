# AI 인터뷰 시스템 기능 고도화 구현 내용 (Walkthrough)

본 문서는 최근 AI 모델 파이프라인(Python LLM)과 자바 코어(Java Core) 백엔드에 반영된 주요 기능 고도화 내역을 설명합니다. 크게 **AI의 상황 인지 능력(Context) 향상**과 **시스템 장애 복원성(Resilience) 확보**에 초점을 맞추었습니다.

---

## 1. Python LLM 서버 (LangGraph 파이프라인 고도화)

기존의 단순 문자열 입출력이 아닌, LangGraph 워크플로우를 활용하여 검색, 기억 관리, 상태 추론 기능을 추가했습니다.

### 1-1. 이력서 RAG (Vector Database 연동)
*   **구현 파일**: [services/infra/llm/engine/nodes.py](file:///Users/shin-yoonsik/Desktop/ai-interview-project/services/infra/llm/engine/nodes.py) 주입 로직
*   **내용**: 면접 시작 지점([fetch_context](file:///Users/shin-yoonsik/Desktop/ai-interview-project/services/infra/llm/engine/nodes.py#43-90) 노드)에서 `psycopg2`를 통해 PostgreSQL의 `resume.vector_store`에 직접 쿼리를 날립니다. 면접 세션(Interview ID)과 연결된 사용자의 이력서 조각(Vector Chunk) 상위 5개를 미리(Pre-fetch) 가져옵니다. 
*   **효과**: 면접관 LLM은 답변 대기시간(Zero-Latency) 제약 없이 즉각적으로 질문(SystemPrompt)에 이력서 정보를 녹여낼 수 있습니다.

### 1-2. 외부 검색 도구 (Tavily Web Search)
*   **구현 파일**: [services/infra/llm/engine/nodes.py](file:///Users/shin-yoonsik/Desktop/ai-interview-project/services/infra/llm/engine/nodes.py) 내 `TavilySearchResults` 도구
*   **내용**: 사용자가 선택한 회사명(`company_name`)과 직무(`domain`) 데이터를 활용해 "최신 기술 스택, 채용 블로그, 최근 뉴스"를 자동으로 검색하여 컨텍스트로 주입합니다.
*   **설정**: `TAVILY_API_KEY` 환경 변수가 추가되었으며, 별도의 노드로 분리되어 면접 개시 후 로딩 타임에 병렬 수집(Concurrent Fetch)되도록 설계되었습니다.

### 1-3. 롤링 메모리 (Rolling Window Memory 방어)
*   **구현 파일**: [services/infra/llm/engine/nodes.py](file:///Users/shin-yoonsik/Desktop/ai-interview-project/services/infra/llm/engine/nodes.py) 내 [summarize_memory](file:///Users/shin-yoonsik/Desktop/ai-interview-project/services/infra/llm/engine/nodes.py#199-227) 함수
*   **내용**: 사용자/시스템 대화 이력(`history`)이 15턴 이상(약 30개 메시지) 쌓이면 모델의 최대 토큰을 초과할 수 있습니다. 이를 방지하기 위해 15턴 초과 시, LangChain의 `RemoveMessage`를 활용해 가장 오래된 대화 10개를 1개의 줄거리형 `SystemMessage` 압축/요약(Summarize) 텍스트로 치환합니다.

---

## 2. Java Core 백엔드 (RDBMS 백업 및 동기화)

Redis 캐시에 전적으로 의존하던 인터뷰 흐름(Hot State)을 모니터링하고 영구히 기록하기 위한 백업 로직을 구축했습니다.

### 2-1. RDBMS JSONB 상태 스냅샷 로깅 (State Snapshot)
*   **구현 파일**: [V001__init.sql](file:///Users/shin-yoonsik/Desktop/ai-interview-project/services/domains/auth/bin/main/db/migration/oracle/V001__init.sql) 하단 병합, [InterviewStateSnapshotJpaEntity.java](file:///Users/shin-yoonsik/Desktop/ai-interview-project/services/domains/interview/src/main/java/me/unbrdn/core/interview/adapter/out/persistence/entity/InterviewStateSnapshotJpaEntity.java)
*   **내용**: Redis가 비정상 종료되더라도 복구할 수 있도록, 상태가 변경될 때마다 RDBMS의 `interview_state_snapshot` 테이블에 JSONB 포맷으로 로그를 찍습니다.
*   **비동기 처리 구조**:
    1.  Core의 `ManageSessionStateAdapter`가 Redis 값 저장/증가를 완료합니다.
    2.  동시에 Spring의 `ApplicationEventPublisher`를 통해 [SessionStateUpdatedEvent](file:///Users/shin-yoonsik/Desktop/ai-interview-project/services/domains/interview/src/main/java/me/unbrdn/core/interview/application/event/SessionStateUpdatedEvent.java#7-20) 모델을 던집니다.
    3.  `@Async`가 붙은 [RecordStateSnapshotListener](file:///Users/shin-yoonsik/Desktop/ai-interview-project/services/domains/interview/src/main/java/me/unbrdn/core/interview/application/interactor/RecordStateSnapshotListener.java#15-46)가 이를 받아 백그라운드 스레드 작업으로 DB에 `INSERT` 합니다.
*   **효과**: 면접 도중 발생한 난이도 변화, 스테이지 변동, 발언 순번 변경 등 모든 **핵심 상태값의 타임라인(족적) 영구 보존**이 가능하며, 사용자 응답 속도에는 1ms의 영향도 주지 않습니다.

### 2-2. gRPC 페이로드 필드 동기화 (Protobuf)
*   **구현 파일**: [llm.proto](file:///Users/shin-yoonsik/Desktop/ai-interview-project/services/proto/llm/v1/llm.proto), [LlmGrpcAdapter.java](file:///Users/shin-yoonsik/Desktop/ai-interview-project/services/domains/interview/src/main/java/me/unbrdn/core/interview/adapter/out/grpc/LlmGrpcAdapter.java)
*   **내용**: 백엔드에서 Python으로 명령을 내보내는 gRPC Payload에 새롭게 정의한 `participating_personas` (배열), `company_name`, `domain`, `scheduled_duration_minutes`를 추가했습니다.
*   **명확성 확보**: 사용자가 선택한 두 명의 면접관이 `["HR", "TECH"]` 라면 이 정보를 고스란히 LangGraph로 토스하며, AI는 이 풀(Pool) 내에서만 발화자를 라우팅(Routing) 하도록 안전 장치를 마련했습니다.

---

## 3. 인터뷰 흐름 및 레이턴시 최적화 (2026-03-29)

지원자의 체감 대기 시간을 최소화하고, 자기소개 결과에 따른 자연스러운 대화 전환을 위해 프론트엔드와 백엔드 간의 상태 동기화 및 VAD 로직을 고도화했습니다.

### 3-1. 단계별 동적 VAD (Voice Activity Detection) 최적화
*   **구현 파일**: [useAudioRecorder.ts](file:///Users/shin-yoonsik/Desktop/ai-interview-project/frontend/src/hooks/useAudioRecorder.ts), [Interview.tsx](file:///Users/shin-yoonsik/Desktop/ai-interview-project/frontend/src/pages/Interview.tsx)
*   **내용**: 기존에 일률적으로 1.5초였던 음성 종료 감지 시점(redemptionMs)을 인터뷰 단계에 따라 다르게 적용했습니다.
    - **인사(`CANDIDATE_GREETING`)**: **400ms** (인지 즉시 다음 단계로 전이)
    - **자기소개(`SELF_INTRO`)**: **800ms** (빠른 리트라이 판단)
    - **일반 질문**: **1500ms** (안정적인 답변 수집)
*   **효과**: 인사 단계 등에서 불필요한 대기 시간을 1초 이상 단축하여 사용자에게 매우 빠른 반응성을 제공합니다.

### 3-2. 자기소개 통계 기반 오디오 분기 (Branching Logic)
*   **구현 파일**: [Interview.tsx](file:///Users/shin-yoonsik/Desktop/ai-interview-project/frontend/src/pages/Interview.tsx) 내 `setOnStageChanged`, 백엔드 Interactor들
*   **내용**: 자기소개 단계가 끝날 때 백엔드로부터 `selfIntroRetryCount`와 `selfIntroElapsedSeconds` 데이터를 수신하여 프론트엔드에서 오디오를 분기합니다.
    - **성공**: 30초 이상 발화 시 `transition_intro_edge` 재생 (긍정적인 안내)
    - **실패/중단**: 3회 리트라이 초과 또는 강제 전이 시 `intervene_intro_edge` 재생 (정중한 중단 안내)
*   **효과**: 면접 상황에 맞는 인간적인 안내 멘트를 제공하여 면접의 완결성을 높였습니다.

### 3-3. 면접관 페르소나 및 안내 멘트 강화
*   **구현 파일**: [rebuild_audio_assets.py](file:///Users/shin-yoonsik/Desktop/ai-interview-project/scripts/rebuild_audio_assets.py), [Interview.tsx](file:///Users/shin-yoonsik/Desktop/ai-interview-project/frontend/src/pages/Interview.tsx)
*   **내용**:
    - 모든 면접관의 자기소개 멘트에 "안녕하세요. 저는" 접두어를 추가하여 전문성을 강화했습니다.
    - 자기소개 리트라이 안내 문구를 "답변이 너무 짧습니다. 내용을 조금 더 구체적으로 말씀해 주시겠어요?"로 명확화하고 음성 에셋을 일괄 재생성했습니다.
    - 인사 단계 UI의 예시 문구를 직관적으로 수정했습니다.
