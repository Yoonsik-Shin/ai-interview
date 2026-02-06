--
-- V003: Update resumes table for Presigned URL flow and document processing
--

ALTER TABLE resumes
ADD COLUMN file_path VARCHAR(500),
ADD COLUMN status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
ADD COLUMN image_urls JSONB,
ADD COLUMN vector_status VARCHAR(20);

COMMENT ON COLUMN resumes.file_path IS 'Object Storage 내 파일 경로';
COMMENT ON COLUMN resumes.status IS '이력서 전체 처리 상태 (PENDING, PROCESSING, COMPLETED, FAILED)';
COMMENT ON COLUMN resumes.image_urls IS '추출된 이미지 URL 목록 (JSON 배열)';
COMMENT ON COLUMN resumes.vector_status IS '벡터 DB 저장 상태';
