-- V005: interview_session 테이블에 누락된 컬럼들 추가 (stage, domain, count, duration, intro)
-- LLM 프롬프트 개인화를 위한 세션 메타데이터 저장

-- Stage 컬럼 추가 (기존 V004가 누락된 경우를 대비)
ALTER TABLE interview_session 
ADD COLUMN IF NOT EXISTS stage VARCHAR(20) DEFAULT 'WAITING' NOT NULL;

-- Domain 컬럼 추가 (기본값: 'IT')
ALTER TABLE interview_session 
ADD COLUMN IF NOT EXISTS domain VARCHAR(100) DEFAULT 'IT' NOT NULL;

-- Interviewer Count 컬럼 추가 (기본값: 1)
ALTER TABLE interview_session
ADD COLUMN IF NOT EXISTS interviewer_count INT DEFAULT 1 NOT NULL;

-- Target Duration 컬럼 추가 (기본값: 10분)
ALTER TABLE interview_session
ADD COLUMN IF NOT EXISTS target_duration_minutes INT DEFAULT 10 NOT NULL;

-- Self Introduction 컬럼 추가 (TEXT 형식)
ALTER TABLE interview_session
ADD COLUMN IF NOT EXISTS self_introduction TEXT;

-- 인덱스 추가 (필요 시 필터링 용도)
CREATE INDEX IF NOT EXISTS idx_interview_session_domain ON interview_session(domain);
