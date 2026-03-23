-- Extensions
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

CREATE TABLE oauth_provider (
    id uuid NOT NULL,
    company_name character varying(50) NOT NULL,
    CONSTRAINT oauth_provider_pkey PRIMARY KEY (id),
    CONSTRAINT oauth_provider_company_name_key UNIQUE (company_name)
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

CREATE TABLE users (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    nickname character varying(50) NOT NULL,
    role character varying(31) NOT NULL,
    is_active character varying(20) NOT NULL,
    phone_number character varying(20) NOT NULL,
    company_code character varying(255),
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

CREATE TABLE candidate_options (
    id uuid NOT NULL,
    is_resume_public boolean NOT NULL,
    is_interview_public boolean NOT NULL,
    CONSTRAINT candidate_options_pkey PRIMARY KEY (id),
    CONSTRAINT fk_candidate_options_candidate FOREIGN KEY (id) REFERENCES users (id)
);

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
    CONSTRAINT fk_admin_audit_admin FOREIGN KEY (admin_id) REFERENCES admin (id)
);
