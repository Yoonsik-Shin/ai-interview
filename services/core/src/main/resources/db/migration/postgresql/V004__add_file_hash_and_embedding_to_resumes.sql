--
-- V004: Add file_hash and embedding (vector search) to resumes
--

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE resumes
ADD COLUMN file_hash VARCHAR(64),
ADD COLUMN embedding vector(1536);

CREATE INDEX idx_resumes_file_hash ON resumes(file_hash);

COMMENT ON COLUMN resumes.file_hash IS '파일 내용 SHA-256 해시값';
COMMENT ON COLUMN resumes.embedding IS '이력서 내용 벡터 임베딩 (1536차원)';
