-- V012: Add turn_count to interview_session for reliable state management
-- Version: Oracle

ALTER TABLE interview_session ADD turn_count NUMBER(10) DEFAULT 0 NOT NULL;

COMMENT ON COLUMN interview_session.turn_count IS '현재까지 진행된 면접 대화(Q&A) 횟수';
