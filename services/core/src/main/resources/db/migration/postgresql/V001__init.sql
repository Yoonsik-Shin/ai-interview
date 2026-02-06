--
-- V001: PostgreSQL initial schema (Flyway baseline)
-- Entity-based schema; all ID columns use UUID type (UUIDv7).
--

-- =============================================================================
-- Reference / standalone tables (no FK)
-- =============================================================================

CREATE TABLE oauth_provider (
    id uuid NOT NULL,
    company_name character varying(50) NOT NULL,
    CONSTRAINT oauth_provider_pkey PRIMARY KEY (id),
    CONSTRAINT oauth_provider_company_name_key UNIQUE (company_name)
);

CREATE TABLE job_field (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    CONSTRAINT job_field_pkey PRIMARY KEY (id)
);

CREATE TABLE pg_provider (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pg_provider_pkey PRIMARY KEY (id),
    CONSTRAINT pg_provider_name_key UNIQUE (name)
);

CREATE TABLE term (
    id uuid NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    version integer NOT NULL,
    deprecated_at timestamp without time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT term_pkey PRIMARY KEY (id)
);

CREATE TABLE skills (
    id uuid NOT NULL,
    name character varying(50) NOT NULL,
    category character varying(10) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT skills_pkey PRIMARY KEY (id),
    CONSTRAINT skills_name_key UNIQUE (name)
);

CREATE TABLE plan (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    price integer NOT NULL,
    description text,
    deprecated_at timestamp without time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT plan_pkey PRIMARY KEY (id),
    CONSTRAINT plan_name_key UNIQUE (name)
);

CREATE TABLE "package" (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    price integer NOT NULL,
    description text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT package_pkey PRIMARY KEY (id)
);

CREATE TABLE product (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(20) NOT NULL,
    price integer NOT NULL,
    currency character varying(10) NOT NULL,
    description text,
    deprecated_at timestamp without time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT product_pkey PRIMARY KEY (id)
);

CREATE TABLE admin (
    id uuid NOT NULL,
    username character varying(50) NOT NULL,
    password character varying(255) NOT NULL,
    role character varying(20) NOT NULL,
    email character varying(255) NOT NULL,
    phone_number character varying(20),
    is_active boolean NOT NULL,
    last_login_at timestamp without time zone,
    last_login_ip character varying(45),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT admin_pkey PRIMARY KEY (id),
    CONSTRAINT admin_username_key UNIQUE (username),
    CONSTRAINT admin_email_key UNIQUE (email),
    CONSTRAINT admin_role_check CHECK (role = 'MASTER')
);

-- =============================================================================
-- Users (single-table inheritance: User / Candidate / Recruiter)
-- =============================================================================

CREATE TABLE users (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    nickname character varying(50) NOT NULL,
    role character varying(31) NOT NULL,
    is_active character varying(20) NOT NULL,
    phone_number character varying(20) NOT NULL,
    verified_email character varying(255),
    profile_image_url character varying(500),
    deleted_at timestamp with time zone,
    last_logined_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_nickname_key UNIQUE (nickname)
);

-- =============================================================================
-- User-related tables
-- =============================================================================

CREATE TABLE candidate_options (
    id uuid NOT NULL,
    is_resume_public boolean NOT NULL,
    is_interview_public boolean NOT NULL,
    CONSTRAINT candidate_options_pkey PRIMARY KEY (id),
    CONSTRAINT fk_candidate_options_candidate FOREIGN KEY (id) REFERENCES users (id)
);

CREATE TABLE wallet (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    free_credits integer NOT NULL,
    paid_credits integer NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    CONSTRAINT wallet_pkey PRIMARY KEY (id),
    CONSTRAINT wallet_user_id_key UNIQUE (user_id),
    CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE resumes (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    title character varying(100) NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT resumes_pkey PRIMARY KEY (id),
    CONSTRAINT fk_resumes_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE career (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    job_field_id uuid NOT NULL,
    company_name character varying(255) NOT NULL,
    department character varying(255),
    description text,
    started_at date NOT NULL,
    ended_at date,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT career_pkey PRIMARY KEY (id),
    CONSTRAINT fk_career_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_career_job_field FOREIGN KEY (job_field_id) REFERENCES job_field (id)
);

CREATE TABLE candidate_desire_job_field (
    candidate_id uuid NOT NULL,
    job_field_id uuid NOT NULL,
    CONSTRAINT candidate_desire_job_field_pkey PRIMARY KEY (candidate_id, job_field_id),
    CONSTRAINT fk_cddjf_candidate FOREIGN KEY (candidate_id) REFERENCES users (id),
    CONSTRAINT fk_cddjf_job_field FOREIGN KEY (job_field_id) REFERENCES job_field (id)
);

CREATE TABLE user_oauths (
    provider_id uuid NOT NULL,
    user_id uuid NOT NULL,
    provider_user_id character varying(255) NOT NULL,
    access_token character varying(500) NOT NULL,
    token_expires_at timestamp without time zone NOT NULL,
    CONSTRAINT user_oauths_pkey PRIMARY KEY (provider_id, user_id),
    CONSTRAINT fk_user_oauths_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_user_oauths_provider FOREIGN KEY (provider_id) REFERENCES oauth_provider (id)
);

CREATE TABLE user_term_agreement (
    term_id uuid NOT NULL,
    user_id uuid NOT NULL,
    is_agreed boolean NOT NULL,
    agreed_at timestamp without time zone NOT NULL,
    ip_address character varying(50),
    CONSTRAINT user_term_agreement_pkey PRIMARY KEY (term_id, user_id),
    CONSTRAINT fk_uta_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_uta_term FOREIGN KEY (term_id) REFERENCES term (id)
);

CREATE TABLE user_skills (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    skill_id uuid NOT NULL,
    proficiency_level integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT user_skills_pkey PRIMARY KEY (id),
    CONSTRAINT user_skills_user_id_skill_id_key UNIQUE (user_id, skill_id),
    CONSTRAINT fk_user_skills_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_user_skills_skill FOREIGN KEY (skill_id) REFERENCES skills (id)
);

-- =============================================================================
-- Subscription / Payment
-- =============================================================================

CREATE TABLE plan_quota (
    id uuid NOT NULL,
    plan_id uuid NOT NULL,
    quota_name character varying(100) NOT NULL,
    quota_amount integer NOT NULL,
    quota_unit character varying(20) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT plan_quota_pkey PRIMARY KEY (id),
    CONSTRAINT fk_plan_quota_plan FOREIGN KEY (plan_id) REFERENCES plan (id)
);

CREATE TABLE package_content (
    id uuid NOT NULL,
    package_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer NOT NULL,
    CONSTRAINT package_content_pkey PRIMARY KEY (id),
    CONSTRAINT fk_package_content_package FOREIGN KEY (package_id) REFERENCES "package" (id),
    CONSTRAINT fk_package_content_product FOREIGN KEY (product_id) REFERENCES product (id)
);

CREATE TABLE subscription (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone,
    is_active boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT subscription_pkey PRIMARY KEY (id),
    CONSTRAINT fk_subscription_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_subscription_plan FOREIGN KEY (plan_id) REFERENCES plan (id)
);

CREATE TABLE subscription_usages (
    id uuid NOT NULL,
    subscription_id uuid NOT NULL,
    quota_name character varying(100) NOT NULL,
    used_amount integer NOT NULL,
    usage_month character varying(7) NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    CONSTRAINT subscription_usages_pkey PRIMARY KEY (id),
    CONSTRAINT fk_subscription_usages_subscription FOREIGN KEY (subscription_id) REFERENCES subscription (id)
);

CREATE TABLE payment (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    pg_provider_id uuid NOT NULL,
    amount integer NOT NULL,
    currency character varying(10) NOT NULL,
    status character varying(20) NOT NULL,
    pg_transaction_id character varying(255) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT payment_pkey PRIMARY KEY (id),
    CONSTRAINT payment_pg_transaction_id_key UNIQUE (pg_transaction_id),
    CONSTRAINT fk_payment_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_payment_pg_provider FOREIGN KEY (pg_provider_id) REFERENCES pg_provider (id)
);

-- =============================================================================
-- Wallet / Credit / Inventory
-- =============================================================================

CREATE TABLE credit_transaction (
    id uuid NOT NULL,
    wallet_id uuid NOT NULL,
    amount integer NOT NULL,
    type character varying(20) NOT NULL,
    reference_type character varying(50) NOT NULL,
    reference_id character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT credit_transaction_pkey PRIMARY KEY (id),
    CONSTRAINT credit_transaction_type_check CHECK (type IN ('INCREASE', 'DECREASE')),
    CONSTRAINT credit_transaction_reference_type_check CHECK (reference_type IN ('PAYMENT', 'PRODUCT_USAGE', 'REFUND', 'ADMIN_ADJUSTMENT')),
    CONSTRAINT fk_credit_transaction_wallet FOREIGN KEY (wallet_id) REFERENCES wallet (id)
);

CREATE TABLE inventory (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    total_count integer NOT NULL,
    remaining_count integer NOT NULL,
    expired_at timestamp without time zone NOT NULL,
    status character varying(20) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT inventory_pkey PRIMARY KEY (id),
    CONSTRAINT fk_inventory_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES product (id)
);

CREATE TABLE product_usage_history (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    source_type character varying(20) NOT NULL,
    amount integer NOT NULL,
    reference_id character varying(255) NOT NULL,
    reference_type character varying(50) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT product_usage_history_pkey PRIMARY KEY (id),
    CONSTRAINT fk_puh_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_puh_product FOREIGN KEY (product_id) REFERENCES product (id)
);

-- =============================================================================
-- Interview
-- =============================================================================

CREATE TABLE interview_session (
    id uuid NOT NULL,
    session_uuid character varying(36) NOT NULL,
    candidate_id uuid NOT NULL,
    resume_id uuid,
    personality character varying(20) NOT NULL,
    type character varying(20) NOT NULL,
    status character varying(20) NOT NULL,
    stage character varying(20) NOT NULL,
    self_intro_start_time timestamp without time zone,
    started_at timestamp without time zone,
    ended_at timestamp without time zone,
    domain character varying(100) NOT NULL,
    interviewer_count integer NOT NULL,
    target_duration_minutes integer NOT NULL,
    self_introduction text,
    current_difficulty integer NOT NULL,
    last_interviewer_id character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT interview_session_pkey PRIMARY KEY (id),
    CONSTRAINT interview_session_session_uuid_key UNIQUE (session_uuid),
    CONSTRAINT fk_interview_session_candidate FOREIGN KEY (candidate_id) REFERENCES users (id),
    CONSTRAINT fk_interview_session_resume FOREIGN KEY (resume_id) REFERENCES resumes (id)
);

CREATE TABLE interview_session_roles (
    interview_session_id uuid NOT NULL,
    role character varying(255) NOT NULL,
    CONSTRAINT fk_interview_session_roles_session FOREIGN KEY (interview_session_id) REFERENCES interview_session (id)
);

CREATE TABLE interview_history (
    id uuid NOT NULL,
    user_name character varying(255),
    user_question text,
    ai_response text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT interview_history_pkey PRIMARY KEY (id)
);

CREATE TABLE interview_qna (
    id uuid NOT NULL,
    interview_id uuid NOT NULL,
    turn_number integer NOT NULL,
    question_text text NOT NULL,
    answer_text text,
    stt_text text,
    analysis_data jsonb,
    media_url character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT interview_qna_pkey PRIMARY KEY (id),
    CONSTRAINT interview_qna_interview_id_turn_number_key UNIQUE (interview_id, turn_number),
    CONSTRAINT fk_interview_qna_session FOREIGN KEY (interview_id) REFERENCES interview_session (id)
);

CREATE TABLE interview_reports (
    id uuid NOT NULL,
    interview_id uuid NOT NULL,
    total_score integer NOT NULL,
    pass_fail_status character varying(10) NOT NULL,
    summary_text text,
    resume_feedback text,
    detail_metrics jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT interview_reports_pkey PRIMARY KEY (id),
    CONSTRAINT interview_reports_interview_id_key UNIQUE (interview_id),
    CONSTRAINT fk_interview_reports_session FOREIGN KEY (interview_id) REFERENCES interview_session (id)
);

CREATE TABLE interview_results (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    interview_id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    user_answer text,
    ai_answer text,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT interview_results_pkey PRIMARY KEY (id)
);

-- =============================================================================
-- Admin audit
-- =============================================================================

CREATE TABLE admin_audit (
    id uuid NOT NULL,
    admin_id uuid NOT NULL,
    action_type character varying(50) NOT NULL,
    target_table character varying(100),
    target_id character varying(100),
    description character varying(1000),
    ip_address character varying(45) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT admin_audit_pkey PRIMARY KEY (id),
    CONSTRAINT admin_audit_action_type_check CHECK (action_type IN ('CREATE', 'UPDATE', 'DELETE', 'PATCH', 'PUT')),
    CONSTRAINT fk_admin_audit_admin FOREIGN KEY (admin_id) REFERENCES admin (id)
);
