# 3-Track 아키텍처 기반 Core 백엔드 리팩토링 플랜

`docs/redis_3track_analysis.md` 분석 문서를 완벽한 기준점으로 삼아, 과거의 단일 집중형(God Object) 아키텍처를 해체하고 무경합성(Lock-free) 3-Track 아키텍처로 전환하는 마스터 플랜입니다. 가치가 없어진 모든 레거시 코드를 철저히 삭제합니다.

---

## Proposed Changes

### 1. RDBMS 다이어트 및 과거 유산 완전 삭제 (Dead Code Deletion)

**현상 및 목표**: 기존 아키텍처에서 Core 서버 DB가 모든 것을 통제하려고 하면서 발생한 병목과 복잡도를 과감히 제거합니다.

#### [DELETE] `InterviewQnAJpaEntity.java` 및 종속 클래스
- 기존의 질문/답변이 1:1 매핑되던 단일 행 Entity(QnA) 구조 폐기.
- 연관된 Repository, DTO, Mapper 클래스 일괄 삭제.

#### [DELETE] `TokenAccumulator.java`
- 메모리에 스트리밍 토큰을 버퍼링하던 객체 삭제 (Track 1 APPEND 및 Track 3 XADD로 전면 대체됨).

#### [MODIFY] `InterviewSession.java` 엔티티 초경량화
- `stage`, `currentDifficulty`, `lastInterviewerId`, `pausedAt`, `interviewerCount`, `roles` 등 실시간으로 변동되던 모든 컬럼 제거.
- `transitionToCandidateGreeting()`, `finishInterview()` 등 하드코딩된 상태 전이 비즈니스 로직(메서드) 전부 삭제.
- 핵심 `Status`(IN_PROGRESS, COMPLETED)와 기본 설정 팩트, `turnCount`만 남김.

#### [NEW] `V__create_interview_messages.sql` (DB 마이그레이션)
- 기존 `interview_qna` 테이블을 DROP 처리.
- `interview_messages` (Append-Only) 테이블 CREATE 문 작성 (Flyway/Liquibase용).

---

### 2. 서버 사이드 다중 트래픽 방어벽 (Server-Side Guard) 구축

**현상 및 목표**: 클라이언트 UI에만 의존하던 마이크/발언 제어의 한계를 극복하고, Network Latency로 인한 Race Condition을 백엔드단에서 원천 차단합니다.

#### [MODIFY] `interview.gateway.ts` (Socket 서버 1차 방어벽)
- **로직**: `interview:audio_chunk` 소켓 이벤트 인입 시, Track 3 Redis (`interview:session:hash`)의 `status`를 O(1) 수준으로 즉시 조회.
- **방어**: 상태가 `LISTENING`이 아닐 경우 오디오 청크를 STT 큐로 릴레이하지 않고 **Drop(폐기)** 처리 추가.

#### [MODIFY] `ProcessUserAnswerInteractor.java` (Core 서버 2차 방어벽)
- **로직**: 사용자 발화 완료 이벤트 수신 시 비즈니스 진입 전 Track 3 상태 재확인.
- **방어**: 유효 트래픽일 경우 상태를 즉시 `THINKING`으로 Atomic하게 갱신(Lock)하여 중복/지연된 과거 찌꺼기 오디오 처리 완벽 차단.

---

### 3. Track 3 다중 컨슈머 병렬 스트림(Streams) 구현

**현상 및 목표**: LLM이 문장을 다 만들 때까지 DB Insert와 TTS 합성을 블로킹(대기)하던 기존 로직을 비동기 이벤트 스트림으로 분리/개선합니다.

#### [NEW] `SentenceStreamPublisher.java` (Core 발행자)
- LLM에서 넘어오는 토큰들이 뭉쳐 마침표(`.`, `?`)가 완성될 때마다, DB 저장을 기다리지 않고 즉시 Track 3 `interview:sentence:stream`에 문장을 **XADD** 전송.

#### [NEW] `CoreDbSaverWorker.java` (Core 서버 컨슈머 B)
- `interview:sentence:stream`에서 `CG_DB_SAVER` 단위 그룹으로 `XREADGROUP` 메시지 소비.
- 가져온 청크 문장을 `InterviewMessage` 엔티티로 변환하여 DB에 순수하게 **INSERT** 처리 후 `XACK`.

#### [MODIFY] Python TTS Service (Py 컨슈머 A)
- 기존 단일 `RPOP` 방식의 List 기반 Queue를 버림.
- Core와 동일한 `interview:sentence:stream`을 `CG_TTS` 그룹으로 소비(`XREADGROUP`)하여 음성 합성 파이프라인 진행.

---

## Verification Plan

### Manual Verification
1. **과거 유산 삭제 검증**: 프로젝트 Re-build 시 컴파일 에러 여부 확인 (사용되지 않는 레거시 의존성/메서드/클래스가 완벽히 제거되었는지 확인).
2. **방어벽 로직 테스트**: 클라이언트단 `stopRecording()` 로직을 강제로 무력화하고 임의 오디오 패킷을 발송했을 때, Socket이나 Core에서 즉시 Drop & Return 되는지 로그로 직접 확인.
3. **병렬 스트림 확인**: LLM 답변 생성 도중(스트리밍) 실시간으로 TTS 오디오가 생성되어 클라이언트까지 도달하는지, 그리고 DB `interview_messages` 테이블에 문장 단위 Row 데이터가 정상적으로 차곡차곡 쌓이는지 조회 검증.
