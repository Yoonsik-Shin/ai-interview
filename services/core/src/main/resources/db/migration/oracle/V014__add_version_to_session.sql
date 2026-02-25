-- 낙관적 락(Optimistic Locking)을 위한 version 컬럼 추가
ALTER TABLE interview_session ADD version NUMBER(19) DEFAULT 0 NOT NULL;
