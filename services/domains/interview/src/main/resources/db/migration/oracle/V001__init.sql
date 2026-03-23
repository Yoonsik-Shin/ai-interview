CREATE TABLE job_field (
    id RAW(16) NOT NULL,
    name VARCHAR2(100) NOT NULL,
    CONSTRAINT job_field_pkey PRIMARY KEY (id)
);

CREATE TABLE skills (
    id RAW(16) NOT NULL,
    name VARCHAR2(50) NOT NULL,
    category VARCHAR2(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT skills_pkey PRIMARY KEY (id),
    CONSTRAINT skills_name_key UNIQUE (name)
);

CREATE TABLE user_skills (
    id RAW(16) NOT NULL,
    user_id RAW(16) NOT NULL,
    skill_id RAW(16) NOT NULL,
    proficiency_level NUMBER(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT user_skills_pkey PRIMARY KEY (id),
    CONSTRAINT user_skills_user_id_skill_id_key UNIQUE (user_id, skill_id),
    CONSTRAINT fk_user_skills_user FOREIGN KEY (user_id) REFERENCES auth.users (id),
    CONSTRAINT fk_user_skills_skill FOREIGN KEY (skill_id) REFERENCES skills (id)
);

CREATE TABLE career (
    id RAW(16) NOT NULL,
    user_id RAW(16) NOT NULL,
    job_field_id RAW(16) NOT NULL,
    company_name VARCHAR2(255) NOT NULL,
    department VARCHAR2(255),
    description CLOB,
    started_at DATE NOT NULL,
    ended_at DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT career_pkey PRIMARY KEY (id),
    CONSTRAINT fk_career_user FOREIGN KEY (user_id) REFERENCES auth.users (id),
    CONSTRAINT fk_career_job_field FOREIGN KEY (job_field_id) REFERENCES job_field (id)
);

CREATE TABLE candidate_desire_job_field (
    candidate_id RAW(16) NOT NULL,
    job_field_id RAW(16) NOT NULL,
    CONSTRAINT candidate_desire_job_field_pkey PRIMARY KEY (candidate_id, job_field_id),
    CONSTRAINT fk_cddjf_candidate FOREIGN KEY (candidate_id) REFERENCES auth.users (id),
    CONSTRAINT fk_cddjf_job_field FOREIGN KEY (job_field_id) REFERENCES job_field (id)
);

CREATE TABLE interview_session (
    id RAW(16) NOT NULL,
    session_uuid VARCHAR2(36) NOT NULL,
    candidate_id RAW(16) NOT NULL,
    resume_id RAW(16),
    personality VARCHAR2(20) NOT NULL,
    type VARCHAR2(20) NOT NULL,
    status VARCHAR2(20) NOT NULL,
    stage VARCHAR2(20) NOT NULL,
    self_intro_start_time TIMESTAMP,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    domain VARCHAR2(100) NOT NULL,
    interviewer_count NUMBER(10) NOT NULL,
    target_duration_minutes NUMBER(10) NOT NULL,
    initial_target_duration_minutes NUMBER(10) NOT NULL,
    self_introduction CLOB,
    current_difficulty NUMBER(10) NOT NULL,
    initial_difficulty NUMBER(10) NOT NULL,
    last_interviewer_id VARCHAR2(255),
    turn_count NUMBER(10) DEFAULT 0 NOT NULL,
    paused_at TIMESTAMP WITH TIME ZONE,
    resumed_at TIMESTAMP WITH TIME ZONE,
    version NUMBER(19) DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT interview_session_pkey PRIMARY KEY (id),
    CONSTRAINT interview_session_session_uuid_key UNIQUE (session_uuid),
    CONSTRAINT fk_interview_session_candidate FOREIGN KEY (candidate_id) REFERENCES auth.users (id),
    CONSTRAINT fk_interview_session_resume FOREIGN KEY (resume_id) REFERENCES resume.resumes (id)
);

CREATE TABLE interview_session_roles (
    interview_session_id RAW(16) NOT NULL,
    role VARCHAR2(255) NOT NULL,
    CONSTRAINT fk_interview_session_roles_session FOREIGN KEY (interview_session_id) REFERENCES interview_session (id)
);

CREATE TABLE interview_adjustment_log (
    id RAW(16) NOT NULL,
    interview_id RAW(16) NOT NULL,
    adjustment_type VARCHAR2(50) NOT NULL,
    old_value CLOB,
    new_value CLOB,
    reason CLOB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT interview_adjustment_log_pkey PRIMARY KEY (id),
    CONSTRAINT fk_adjustment_log_session FOREIGN KEY (interview_id) REFERENCES interview_session (id)
);
CREATE INDEX idx_interview_adjustment_log_interview_id ON interview_adjustment_log(interview_id);

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
        REFERENCES interview_session(id) ON DELETE CASCADE
);
CREATE INDEX idx_interview_messages_session_idx ON interview_messages(interview_session_id, turn_count, sequence_number);

CREATE TABLE interview_history (
    id RAW(16) NOT NULL,
    user_name VARCHAR2(255),
    user_question CLOB,
    ai_response CLOB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT interview_history_pkey PRIMARY KEY (id)
);

CREATE TABLE interview_reports (
    id RAW(16) NOT NULL,
    interview_id RAW(16) NOT NULL,
    total_score NUMBER(10) NOT NULL,
    pass_fail_status VARCHAR2(10) NOT NULL,
    summary_text CLOB,
    resume_feedback CLOB,
    detail_metrics CLOB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT interview_reports_pkey PRIMARY KEY (id),
    CONSTRAINT interview_reports_interview_id_key UNIQUE (interview_id),
    CONSTRAINT fk_interview_reports_session FOREIGN KEY (interview_id) REFERENCES interview_session (id)
);

CREATE TABLE interview_results (
    id NUMBER GENERATED BY DEFAULT AS IDENTITY,
    interview_id VARCHAR2(255) NOT NULL,
    user_id VARCHAR2(255) NOT NULL,
    user_answer CLOB,
    ai_answer CLOB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT interview_results_pkey PRIMARY KEY (id)
);

CREATE TABLE interview_state_snapshot (
    id RAW(16) NOT NULL,
    interview_session_id RAW(16) NOT NULL,
    state_json CLOB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT interview_state_snapshot_pkey PRIMARY KEY (id),
    CONSTRAINT fk_interview_snapshot_sess FOREIGN KEY (interview_session_id) REFERENCES interview_session (id) ON DELETE CASCADE,
    CONSTRAINT chk_snapshot_json CHECK (state_json IS JSON)
);

CREATE INDEX idx_interview_state_snapshot_sid ON interview_state_snapshot(interview_session_id);
