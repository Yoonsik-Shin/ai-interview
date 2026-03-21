-- V013__create_interview_messages.sql

-- 1. 과거의 테이블 우선 삭제
DROP TABLE IF EXISTS interview_qna;

-- 2. 신규 Append-Only 메시지용 테이블 생성
CREATE TABLE interview_messages (
    id UUID PRIMARY KEY,
    interview_session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    turn_count INT NOT NULL,
    sequence_number INT NOT NULL,
    role VARCHAR(50) NOT NULL,
    content TEXT,
    media_url VARCHAR(2048),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. 빠른 조회를 위한 인덱스 생성
CREATE INDEX idx_interview_messages_session_id_turn_sequence ON interview_messages(interview_session_id, turn_count, sequence_number);
