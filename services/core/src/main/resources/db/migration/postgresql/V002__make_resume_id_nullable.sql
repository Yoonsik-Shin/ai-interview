-- Make resume_id nullable in interviews table
ALTER TABLE interviews ALTER COLUMN resume_id DROP NOT NULL;
