-- 1. Create table for resume embeddings (Chunks)
CREATE TABLE resume_embeddings (
    id uuid NOT NULL,
    resume_id uuid NOT NULL,
    content TEXT,
    embedding vector(384),
    category VARCHAR(50),
    created_at TIMESTAMP(6),
    updated_at TIMESTAMP(6),
    CONSTRAINT resume_embeddings_pkey PRIMARY KEY (id),
    CONSTRAINT fk_resume_embeddings_resume FOREIGN KEY (resume_id) REFERENCES resumes (id) ON DELETE CASCADE
);

-- 2. Index for vector search (Cosine Distance)
-- Note: 'vector_cosine_ops' requires pgvector extension (should be enabled)
CREATE INDEX idx_resume_embeddings_embedding ON resume_embeddings USING hnsw (embedding vector_cosine_ops);

-- 3. Remove embedding column from parent table (Resumes)
-- Checks if column exists before dropping to avoid error if re-running or if V004 didn't add it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resumes' AND column_name = 'embedding') THEN
        ALTER TABLE resumes DROP COLUMN embedding;
    END IF;
END $$;

-- vector_status is kept on resumes table as a summary status
