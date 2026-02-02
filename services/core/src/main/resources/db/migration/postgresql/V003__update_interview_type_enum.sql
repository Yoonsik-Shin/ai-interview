-- V003: Update InterviewType enum to support REAL and PRACTICE values
-- Drop the old check constraint
ALTER TABLE interview_session DROP CONSTRAINT IF EXISTS interview_session_status_check;

-- Add new check constraint with updated values
ALTER TABLE interview_session ADD CONSTRAINT interview_session_type_check 
    CHECK (type IN ('REAL', 'PRACTICE'));
