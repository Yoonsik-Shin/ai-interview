-- V013: Add paused_at and resumed_at to interview_session for pause/resume support
-- Version: Oracle

ALTER TABLE interview_session ADD (
    paused_at TIMESTAMP WITH TIME ZONE,
    resumed_at TIMESTAMP WITH TIME ZONE
);

COMMENT ON COLUMN interview_session.paused_at IS '면접이 마지막으로 일시중지된 시각';
COMMENT ON COLUMN interview_session.resumed_at IS '일시중지 후 마지막으로 재개된 시각';
