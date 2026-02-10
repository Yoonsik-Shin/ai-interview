--
-- V006: Make content column nullable in resumes table
--

ALTER TABLE resumes
ALTER COLUMN content DROP NOT NULL;

COMMENT ON COLUMN resumes.content IS '이력서 텍스트 내용 (파일 업로드 완료 후 Document Service에서 채워짐)';
