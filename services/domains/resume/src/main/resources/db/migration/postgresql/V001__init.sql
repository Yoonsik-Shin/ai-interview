CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

CREATE SCHEMA IF NOT EXISTS resume;

CREATE TABLE resume.resumes (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    title character varying(100) NOT NULL,
    content text,
    file_path character varying(500),
    status character varying(20) DEFAULT 'PENDING' NOT NULL,
    image_urls jsonb,
    vector_status character varying(20),
    file_hash character varying(64),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT resumes_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_resumes_file_hash ON resume.resumes(file_hash);

CREATE TABLE resume.resume_embeddings (
    id uuid NOT NULL,
    resume_id uuid NOT NULL,
    content TEXT,
    embedding public.vector(384),
    category VARCHAR(50),
    created_at TIMESTAMP(6),
    updated_at TIMESTAMP(6),
    CONSTRAINT resume_embeddings_pkey PRIMARY KEY (id),
    CONSTRAINT fk_resume_embeddings_resume FOREIGN KEY (resume_id) REFERENCES resume.resumes (id) ON DELETE CASCADE
);

CREATE INDEX idx_resume_embeddings_embedding ON resume.resume_embeddings USING hnsw (embedding public.vector_cosine_ops);

CREATE TABLE resume.vector_store (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT,
    metadata JSONB,
    embedding public.vector(384)
);

CREATE INDEX vector_store_embedding_idx ON resume.vector_store USING hnsw (embedding public.vector_cosine_ops);
CREATE INDEX vector_store_metadata_idx ON resume.vector_store USING gin (metadata);
