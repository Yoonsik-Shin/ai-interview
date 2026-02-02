-- V006: InterviewStage Enum 업데이트
-- GREETING_PROMPT 제거, CANDIDATE_GREETING 및 SELF_INTRO_PROMPT 추가

-- 기존 CHECK 제약조건 삭제
ALTER TABLE interview_session
DROP CONSTRAINT IF EXISTS interview_session_stage_check;

-- 새로운 Stage 값으로 CHECK 제약조건 재생성
ALTER TABLE interview_session
ADD CONSTRAINT interview_session_stage_check 
CHECK (stage IN (
  'WAITING',
  'GREETING',
  'CANDIDATE_GREETING',
  'INTERVIEWER_INTRO',
  'SELF_INTRO_PROMPT',
  'SELF_INTRO',
  'IN_PROGRESS',
  'COMPLETED'
));

-- 기존 GREETING_PROMPT 데이터를 GREETING으로 마이그레이션 (있을 경우)
UPDATE interview_session 
SET stage = 'GREETING'
WHERE stage = 'GREETING_PROMPT';

-- Stage 인덱스 재생성 (새로운 stage 값 반영)
DROP INDEX IF EXISTS idx_interview_session_stage_status;
CREATE INDEX idx_interview_session_stage_status 
ON interview_session(stage, status)
WHERE stage IN ('GREETING', 'CANDIDATE_GREETING', 'INTERVIEWER_INTRO', 'SELF_INTRO_PROMPT', 'SELF_INTRO', 'IN_PROGRESS');
