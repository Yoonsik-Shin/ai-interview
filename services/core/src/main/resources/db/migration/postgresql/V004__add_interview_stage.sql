-- V004: InterviewSession에 stage 필드 및 self_intro_start_time 추가
-- 면접 진행 단계를 관리하기 위한 stage 시스템 도입

-- Stage 컬럼 추가 (기본값: WAITING)
ALTER TABLE interview_session 
ADD COLUMN stage VARCHAR(50) DEFAULT 'WAITING' NOT NULL;

-- 자기소개 시작 시간 추적
ALTER TABLE interview_session
ADD COLUMN self_intro_start_time TIMESTAMP NULL;

-- Stage 값 제약조건 추가
ALTER TABLE interview_session
ADD CONSTRAINT interview_session_stage_check 
CHECK (stage IN (
  'WAITING',
  'GREETING_PROMPT', 
  'GREETING', 
  'INTERVIEWER_INTRO', 
  'SELF_INTRO', 
  'IN_PROGRESS', 
  'COMPLETED'
));

-- 기존 데이터 마이그레이션: 
-- - READY 상태 → WAITING stage
-- - IN_PROGRESS 상태 → IN_PROGRESS stage  
-- - COMPLETED 상태 → COMPLETED stage
UPDATE interview_session 
SET stage = CASE 
    WHEN status = 'READY' THEN 'WAITING'
    WHEN status = 'IN_PROGRESS' THEN 'IN_PROGRESS'
    WHEN status = 'COMPLETED' THEN 'COMPLETED'
    WHEN status = 'CANCELLED' THEN 'COMPLETED'
    ELSE 'WAITING'
END
WHERE stage = 'WAITING';

-- Stage 인덱스 추가 (조회 성능 향상)
CREATE INDEX idx_interview_session_stage 
ON interview_session(stage);

-- Stage + Status 복합 인덱스 (실시간 진행 중인 면접 조회)
CREATE INDEX idx_interview_session_stage_status 
ON interview_session(stage, status)
WHERE stage IN ('GREETING', 'INTERVIEWER_INTRO', 'SELF_INTRO', 'IN_PROGRESS');
