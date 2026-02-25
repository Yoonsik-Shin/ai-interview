-- V009: Track interview adjustments and preserve initial duration
-- Version: PostgreSQL

-- 1. Add initial_target_duration_minutes, initial_difficulty to interview_session
ALTER TABLE interview_session ADD COLUMN initial_target_duration_minutes integer;
ALTER TABLE interview_session ADD COLUMN initial_difficulty integer;

-- 2. Initialize existing data (preserve current target/difficulty as initial)
UPDATE interview_session SET 
    initial_target_duration_minutes = target_duration_minutes,
    initial_difficulty = current_difficulty;

-- 3. Set NOT NULL constraint after initialization
ALTER TABLE interview_session ALTER COLUMN initial_target_duration_minutes SET NOT NULL;
ALTER TABLE interview_session ALTER COLUMN initial_difficulty SET NOT NULL;

-- 4. Create interview_adjustment_log table
CREATE TABLE interview_adjustment_log (
    id uuid NOT NULL,
    interview_id uuid NOT NULL,
    adjustment_type character varying(50) NOT NULL, -- 'TIME_REDUCTION', 'DIFFICULTY_CHANGE', 'STAGE_FORCE_TRANSITION' 등
    old_value text,
    new_value text,
    reason text,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT interview_adjustment_log_pkey PRIMARY KEY (id),
    CONSTRAINT fk_adjustment_log_session FOREIGN KEY (interview_id) REFERENCES interview_session (id)
);

-- Index for performance
CREATE INDEX idx_interview_adjustment_log_interview_id ON interview_adjustment_log(interview_id);
