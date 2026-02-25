-- V011: Track interview adjustments and preserve initial duration
-- Version: Oracle

-- 1. Add initial_target_duration_minutes, initial_difficulty to interview_session
ALTER TABLE interview_session ADD (
    initial_target_duration_minutes INTEGER,
    initial_difficulty INTEGER
);

-- 2. Initialize existing data
UPDATE interview_session SET 
    initial_target_duration_minutes = target_duration_minutes,
    initial_difficulty = current_difficulty;

-- 3. Set NOT NULL constraint
ALTER TABLE interview_session MODIFY (
    initial_target_duration_minutes NOT NULL,
    initial_difficulty NOT NULL
);

-- 4. Create interview_adjustment_log table
CREATE TABLE interview_adjustment_log (
    id RAW(16) NOT NULL,
    interview_id RAW(16) NOT NULL,
    adjustment_type VARCHAR2(50) NOT NULL,
    old_value CLOB,
    new_value CLOB,
    reason CLOB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT interview_adjustment_log_pkey PRIMARY KEY (id),
    CONSTRAINT fk_adjustment_log_session FOREIGN KEY (interview_id) REFERENCES interview_session (id)
);

-- Index for performance
CREATE INDEX idx_adj_log_interview_id ON interview_adjustment_log(interview_id);

COMMENT ON COLUMN interview_adjustment_log.adjustment_type IS '조정 유형 (TIME_REDUCTION, DIFFICULTY_CHANGE 등)';
