-- interview_messages 테이블에 source 컬럼 추가
ALTER TABLE interview_messages ADD (source VARCHAR2(30));

-- 1. 기존 'SYSTEM' 역할을 'AI'로 변경하고 출처(source)를 'SYSTEM'으로 설정
UPDATE interview_messages 
SET role = 'AI', source = 'SYSTEM' 
WHERE role = 'SYSTEM';

-- 2. 기존 'AI' 역할 데이터의 출처를 'LLM'으로 설정
UPDATE interview_messages 
SET source = 'LLM' 
WHERE role = 'AI' AND source IS NULL;

-- 3. 사용자 발화(USER)에 대해서는 기본 'SYSTEM' 설정
UPDATE interview_messages 
SET source = 'SYSTEM' 
WHERE role = 'USER' AND source IS NULL;
