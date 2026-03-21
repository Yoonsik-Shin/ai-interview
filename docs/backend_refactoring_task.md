# Task: 3-Track 기반 백엔드 아키텍처 리팩토링

## Phase 1: RDBMS 다이어트 및 레거시 제거
- [ ] 과거 유산 삭제 1: `InterviewQnAJpaEntity` 구조 및 관련 DTO, Mapper, Repository 삭제
- [ ] 과거 유산 삭제 2: `TokenAccumulator` 버퍼 관리 객체 완전 삭제
- [ ] `InterviewSession` 다이어트: state/stage 컬럼 걷어내기 및 강결합 상태 전이 메서드 폐기
- [ ] 모놀리식 강결합 로직 분해: Track 2/3 통신 체계로 책임 분리 작업

## Phase 2: 다중 방어벽(Server-Side Guard) 구축
- [ ] 1차 방어벽: `interview.gateway.ts` (Socket 서버) 에 Track 3 기반 발화 Drop 검증 로직 구현
- [ ] 2차 방어벽: `ProcessUserAnswerInteractor` (Core 서버) 진입 시 Track 3 상태 재확인 / Lock 로직 구현

## Phase 3: Message Log 스키마 DB 마이그레이션
- [ ] `V__create_interview_messages.sql` 등 Flyway/Liquibase용 DB 마이그레이션 스크립트 작성
- [ ] 삭제된 `interview_qna` 대상 Drop 구문 작성

## Phase 4: Streams 병렬 처리 파이프라인 연동
- [ ] Core 발행자: 마침표 기반 `interview:sentence:stream` XADD Publisher 신규 작성
- [ ] Core 워커: `CG_DB_SAVER` 컨슈머 읽기 및 DB 병렬 INSERT 기능 신규 작성
- [ ] Python 워커: TTS 서비스의 Queue를 `CG_TTS` Streams 모델로 통신 규격 갱신
