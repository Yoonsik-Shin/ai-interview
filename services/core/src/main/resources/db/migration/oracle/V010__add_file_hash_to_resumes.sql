-- V010: Add file_hash and embedding to resumes
ALTER TABLE resumes ADD (
    file_hash VARCHAR2(64),
    embedding VECTOR
);
CREATE INDEX idx_resumes_file_hash ON resumes(file_hash);
