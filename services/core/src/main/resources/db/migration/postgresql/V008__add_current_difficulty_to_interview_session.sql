-- Add current_difficulty column (nullable first to handle existing data)
ALTER TABLE interview_session ADD COLUMN current_difficulty INTEGER;

-- Update existing rows with default value
UPDATE interview_session SET current_difficulty = 3 WHERE current_difficulty IS NULL;

-- Now add NOT NULL constraint
ALTER TABLE interview_session ALTER COLUMN current_difficulty SET NOT NULL;

-- Set default for future inserts
ALTER TABLE interview_session ALTER COLUMN current_difficulty SET DEFAULT 3;

-- Add last_interviewer_id column (can be NULL)
ALTER TABLE interview_session ADD COLUMN last_interviewer_id VARCHAR(255);
