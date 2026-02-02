-- Users 테이블에 password 컬럼 추가
-- Phase 1: 인증 및 사용자 관리 마이그레이션

ALTER TABLE users ADD password VARCHAR2(255) NULL;

-- 기존 사용자들의 password는 NULL로 유지 (기존 데이터 호환성)
-- 새로운 사용자는 회원가입 시 password가 설정됨

COMMENT ON COLUMN users.password IS 'BCrypt 해시된 비밀번호';

