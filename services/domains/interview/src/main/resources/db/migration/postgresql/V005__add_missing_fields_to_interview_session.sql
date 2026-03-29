-- interview_session 테이블에 누락된 컬럼 추가
ALTER TABLE interview_session ADD COLUMN round VARCHAR(20);
ALTER TABLE interview_session ADD COLUMN job_posting_url VARCHAR(500);
ALTER TABLE interview_session ADD COLUMN self_intro_text TEXT;

-- 기존 데이터 하위 호환성을 위해 기본값 설정 (필요시)
UPDATE interview_session SET round = 'TECHNICAL' WHERE round IS NULL;

-- 상용 환경 등에서 NOT NULL 제약조건이 필요한 경우 추가 (현재는 유연성을 위해 생략 가능)
-- ALTER TABLE interview_session ALTER COLUMN round SET NOT NULL;
