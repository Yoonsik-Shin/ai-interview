-- resume 스키마 격리: 기존 public 스키마의 테이블을 resume 스키마로 이동
CREATE SCHEMA IF NOT EXISTS resume;

ALTER TABLE resumes SET SCHEMA resume;
ALTER TABLE resume_embeddings SET SCHEMA resume;
ALTER TABLE vector_store SET SCHEMA resume;
