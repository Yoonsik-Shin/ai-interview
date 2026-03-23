-- Users (password, company_code 포함)
CREATE TABLE users (
    id RAW(16) NOT NULL,
    email VARCHAR2(255) NOT NULL,
    password VARCHAR2(255),
    nickname VARCHAR2(50) NOT NULL,
    role VARCHAR2(31) NOT NULL,
    is_active VARCHAR2(20) NOT NULL,
    phone_number VARCHAR2(20) NOT NULL,
    company_code VARCHAR2(255),
    verified_email VARCHAR2(255),
    profile_image_url VARCHAR2(500),
    deleted_at TIMESTAMP WITH TIME ZONE,
    last_logined_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_nickname_key UNIQUE (nickname)
);

COMMENT ON COLUMN users.password IS 'BCrypt 해시된 비밀번호';

CREATE TABLE oauth_provider (
    id RAW(16) NOT NULL,
    company_name VARCHAR2(50) NOT NULL,
    CONSTRAINT oauth_provider_pkey PRIMARY KEY (id),
    CONSTRAINT oauth_provider_company_name_key UNIQUE (company_name)
);

CREATE TABLE term (
    id RAW(16) NOT NULL,
    title VARCHAR2(255) NOT NULL,
    content CLOB NOT NULL,
    version NUMBER(10) NOT NULL,
    deprecated_at TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT term_pkey PRIMARY KEY (id)
);

CREATE TABLE admin (
    id RAW(16) NOT NULL,
    username VARCHAR2(50) NOT NULL,
    password VARCHAR2(255) NOT NULL,
    role VARCHAR2(20) NOT NULL,
    email VARCHAR2(255) NOT NULL,
    phone_number VARCHAR2(20),
    is_active NUMBER(1) NOT NULL,
    last_login_at TIMESTAMP,
    last_login_ip VARCHAR2(45),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT admin_pkey PRIMARY KEY (id),
    CONSTRAINT admin_username_key UNIQUE (username),
    CONSTRAINT admin_email_key UNIQUE (email),
    CONSTRAINT admin_role_check CHECK (role = 'MASTER')
);

CREATE TABLE candidate_options (
    id RAW(16) NOT NULL,
    is_resume_public NUMBER(1) NOT NULL,
    is_interview_public NUMBER(1) NOT NULL,
    CONSTRAINT candidate_options_pkey PRIMARY KEY (id),
    CONSTRAINT fk_candidate_options_candidate FOREIGN KEY (id) REFERENCES users (id)
);

CREATE TABLE admin_audit (
    id RAW(16) NOT NULL,
    admin_id RAW(16) NOT NULL,
    action_type VARCHAR2(50) NOT NULL,
    target_table VARCHAR2(100),
    target_id VARCHAR2(100),
    description VARCHAR2(1000),
    ip_address VARCHAR2(45) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT admin_audit_pkey PRIMARY KEY (id),
    CONSTRAINT fk_admin_audit_admin FOREIGN KEY (admin_id) REFERENCES admin (id)
);
