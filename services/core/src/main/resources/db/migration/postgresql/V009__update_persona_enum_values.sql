-- V009: Update interview_session_persona_check constraint to match new Persona Enum values
-- Current allowed values: PRESSURE, COMFORTABLE, RANDOM
-- New allowed values: MAIN, TECH, HR, EXEC

-- 1. Drop the old check constraint
ALTER TABLE interview_session DROP CONSTRAINT IF EXISTS interview_session_persona_check;

-- 2. Add new check constraint with updated values
ALTER TABLE interview_session ADD CONSTRAINT interview_session_persona_check 
    CHECK (persona IN ('MAIN', 'TECH', 'HR', 'EXEC'));

-- 3. Update existing data if necessary (though in the logs it fails to insert new ones)
-- If there are old records with old persona names, we should map them.
-- Assuming 'TECH' maps to 'PRESSURE', 'HR' to 'COMFORTABLE', 'MAIN' to 'RANDOM'
-- But since they are already failing to insert, we don't have existing records with new names.
-- If we have old records with old names, we should convert them:
UPDATE interview_session SET persona = 'TECH' WHERE persona = 'PRESSURE';
UPDATE interview_session SET persona = 'HR' WHERE persona = 'COMFORTABLE';
UPDATE interview_session SET persona = 'MAIN' WHERE persona = 'RANDOM';
