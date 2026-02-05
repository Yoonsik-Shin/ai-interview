-- V009: Update interview_session_persona_check constraint to match new Persona Enum values

-- 1. Drop the old check constraint (Oracle syntax might vary slightly but this is standard)
ALTER TABLE interview_session DROP CONSTRAINT interview_session_persona_check;

-- 2. Add new check constraint with updated values
ALTER TABLE interview_session ADD CONSTRAINT interview_session_persona_check 
    CHECK (persona IN ('MAIN', 'TECH', 'HR', 'EXEC'));

-- 3. Update existing data
UPDATE interview_session SET persona = 'TECH' WHERE persona = 'PRESSURE';
UPDATE interview_session SET persona = 'HR' WHERE persona = 'COMFORTABLE';
UPDATE interview_session SET persona = 'MAIN' WHERE persona = 'RANDOM';
