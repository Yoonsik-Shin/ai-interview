--
-- V002: Add company_code to users (Recruiter subtype in single-table inheritance)
--

-- Recruiter (single-table inheritance) uses this column; Candidate leaves it null.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS company_code character varying(255);
