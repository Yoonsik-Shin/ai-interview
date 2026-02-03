-- V007: 자기소개 시간 측정을 위한 self_intro_start_time 컬럼 추가

ALTER TABLE interview_session
ADD (self_intro_start_time TIMESTAMP);

COMMENT ON COLUMN interview_session.self_intro_start_time IS '자기소개 단계 진입 시각';
