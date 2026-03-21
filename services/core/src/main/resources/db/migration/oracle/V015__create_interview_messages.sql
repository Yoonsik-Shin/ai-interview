-- V015__create_interview_messages.sql

-- 1. 과거 테이블 삭제 (존재할 경우)
BEGIN
   EXECUTE IMMEDIATE 'DROP TABLE interview_qna CASCADE CONSTRAINTS';
EXCEPTION
   WHEN OTHERS THEN
      IF SQLCODE != -942 THEN
         RAISE;
      END IF;
END;
/

-- 2. 신규 Append-Only 메시지용 테이블 생성
CREATE TABLE interview_messages (
    id RAW(16) PRIMARY KEY,
    interview_session_id RAW(16) NOT NULL,
    turn_count NUMBER(10) NOT NULL,
    sequence_number NUMBER(10) NOT NULL,
    role VARCHAR2(50) NOT NULL,
    content CLOB,
    media_url VARCHAR2(2048),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_interview_messages_session FOREIGN KEY (interview_session_id) 
        REFERENCES interview_sessions(id) ON DELETE CASCADE
);

-- 3. 빠른 조회를 위한 인덱스 생성
CREATE INDEX idx_interview_messages_session_idx ON interview_messages(interview_session_id, turn_count, sequence_number);
