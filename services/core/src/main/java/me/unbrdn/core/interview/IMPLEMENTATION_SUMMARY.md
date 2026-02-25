# Interview Module Implementation Summary

이 문서는 `me.unbrdn.core.interview` 패키지의 현재 구현 상세를 정리한 문서입니다.

## 1. 개요 (Overview)

Interview 모듈은 사용자와 AI 면접관 간의 **실시간 음성 면접 세션**을 관리합니다.
Hexagonal Architecture를 기반으로 하며, 상태 관리를 위해 **RDB(Oracle/PostgreSQL)**와 **Redis**를 하이브리드로 사용합니다.

---

## 2. 핵심 도메인 모델 (Domain Model)

### `InterviewSession` (Aggregate Root)

- **역할**: 면접의 생명주기와 영속적인 상태(Hard State)를 관리합니다.
- **주요 필드**:
  - `stage`: 면접의 현재 단계 (`WAITING`, `SELF_INTRO`, `IN_PROGRESS` 등)
  - `status`: 세션 상태 (`READY`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`)
  - `roles`: 참여하는 면접관 페르소나 목록 (List<`InterviewRole`>)
  - `personality`: 면접관 성향 (`InterviewPersonality`)
- **특징**: `BaseTimeEntity`를 상속받아 생성/수정 시간을 추적하며 JPA를 통해 영속화됩니다.

### `InterviewStage` (Enum)

면접의 순차적인 단계를 정의합니다.

1. `WAITING`: 연결 대기
2. `GREETING`: 면접관 인사 (Pre-recorded)
3. `CANDIDATE_GREETING`: 지원자 인사 (첫 발화 감지)
4. `INTERVIEWER_INTRO`: 면접관 자기소개 (LLM 생성, 순차적 진행)
5. `SELF_INTRO_PROMPT`: 자기소개 요청 (Pre-recorded)
6. `SELF_INTRO`: 지원자 자기소개 (시간/내용 체크)
7. `IN_PROGRESS`: 본 면접 (Q&A Loop)
8. `LAST_QUESTION_PROMPT`: 마지막 질문 안내
9. `LAST_ANSWER`: 마지막 답변
10. `CLOSING_GREETING`: 마무리 인사
11. `COMPLETED`: 종료

### `InterviewSessionState` (Redis Model)

- **역할**: 면접 진행 중 빈번하게 변경되는 "Hot State"를 관리합니다.
- **저장소**: Redis Hash
- **주요 필드**:
  - `turnCount`: 현재 대화 턴 수
  - `currentDifficulty`: 현재 난이도 (1~5, Adaptive)
  - `participatingPersonas`: 순차 소개에 참여할 페르소나 목록
  - `nextPersonaIndex`: 다음 소개 순서 인덱스
  - `selfIntroRetryCount`: 자기소개 재시도 횟수

---

## 3. 주요 워크플로우 (Key Workflows)

### 3.1. 면접 시작 (`CreateInterviewInteractor`)

1. 사용자(`User`)와 이력서(`Resume`) 유효성 검증.
2. `InterviewSession` 생성 및 저장 (`READY` 상태).
3. **결과**: `interviewId` 반환.

### 3.2. 사용자 발화 처리 (`ProcessUserAnswerInteractor`)

사용자의 음성이 STT를 거쳐 텍스트로 변환되면 실행됩니다.

1. **상태 조회**: `InterviewSession` 로드.
2. **히스토리 저장**: `ConversationHistory`에 사용자 발화(`user`) 추가.
3. **단계 전환 (Stage Transition)**:
   - `CANDIDATE_GREETING` → `INTERVIEWER_INTRO`
   - `SELF_INTRO`: 시간(<30s) 및 재시도 횟수 체크하여 재요청 또는 `IN_PROGRESS` 전환.
   - `LAST_ANSWER` → `CLOSING_GREETING`
4. **LLM 요청**: `CallLlmCommand` 생성하여 LLM 서비스(gRPC) 호출 (Streaming).

### 3.3. LLM 스트리밍 및 응답 처리 (`ProcessLlmTokenInteractor`)

LLM으로부터 토큰이 스트리밍될 때마다 실행됩니다.

1. **Redis Cache**: 토큰을 버퍼에 추가 (`TokenAccumulator`).
2. **Realtime Transcript**: `PublishTranscriptPort`를 통해 Redis Pub/Sub 발행 (Socket 서버가 구독).
3. **TTS Pipeline**: 문장(`.`, `?`, `!`)이 완성될 때마다 `PushTtsQueuePort`로 전송.
4. **Adaptive State Update**: LLM 응답 헤더(Flag)에 따라 난이도(`currentDifficulty`) 또는 시간 조절.
5. **완료 처리**:
   - 전체 응답 `ConversationHistory`에 추가(`assistant`).
   - `InterviewerIntroFinishedEvent` 발행 (순차 소개 로직 트리거).

### 3.4. 순차적 면접관 소개 (`InterviewSequentialIntroListener`)

`INTERVIEWER_INTRO` 단계에서 여러 면접관이 순서대로 인사하는 로직입니다.

1. `InterviewerIntroFinishedEvent` 수신.
2. Redis `InterviewSessionState`의 `nextPersonaIndex` 확인.
3. 다음 순서의 면접관이 있다면 LLM에 자기소개 요청.
4. 모든 면접관이 마쳤으면 `SELF_INTRO_PROMPT` 단계로 전환.

### 3.5. 단계 전환 및 트리거 (`TransitionInterviewStageInteractor`)

명시적인 단계 전환 명령을 처리합니다.

- **`INTERVIEWER_INTRO` 진입 시**: 첫 번째 면접관 소개 자동 트리거.
- **`IN_PROGRESS` 진입 시**: 첫 번째 면접 질문 생성 트리거.
- **`CLOSING_GREETING` 진입 시**: 마무리 인사 생성 트리거.

---

## 4. 아키텍처 매핑 (Architecture Mapping)

| Layer             | Components                                                    | Description                           |
| ----------------- | ------------------------------------------------------------- | ------------------------------------- |
| **Domain**        | `InterviewSession`, `InterviewStage`, `InterviewSessionState` | 비즈니스 규칙, 상태 기계, 엔티티      |
| **Application**   | `~Interactor` (Use Cases)                                     | 비즈니스 흐름 제어, 트랜잭션 관리     |
| **Port (In)**     | `~UseCase` Interfaces                                         | 애플리케이션 진입점                   |
| **Port (Out)**    | `InterviewPort`, `CallLlmPort`, `ManageSessionStatePort`      | 외부 시스템(DB, LLM, Redis) 추상화    |
| **Adapter (In)**  | `InterviewGrpcController`, `SttTranscriptRedisStreamConsumer` | gRPC 요청 및 Redis Stream 이벤트 수신 |
| **Adapter (Out)** | `InterviewPersistenceAdapter`, `LlmGrpcAdapter`               | JPA Repository 및 gRPC Client 구현체  |

---

## 5. 데이터 흐름 요약

`User Speech` → `STT` → `Redis Stream` → `Core(ProcessUserAnswer)` → `LLM(Streaming)` → `Core(ProcessLlmToken)` → `Redis Pub/Sub(Transcript)` & `Kafka/Redis(TTS Queue)` → `TTS` → `Client`
