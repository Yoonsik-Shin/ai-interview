-- V010: Add turn_count to interview_session for reliable state management
-- Version: PostgreSQL

ALTER TABLE interview_session ADD COLUMN turn_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN interview_session.turn_count IS '현재까지 진행된 면접 대화(Q&A) 횟수';
