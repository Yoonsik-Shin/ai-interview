CREATE TABLE resumes (
    id RAW(16) NOT NULL,
    user_id RAW(16) NOT NULL,
    title VARCHAR2(100) NOT NULL,
    content CLOB,
    file_path VARCHAR2(500),
    status VARCHAR2(20) DEFAULT 'PENDING' NOT NULL,
    image_urls CLOB,
    vector_status VARCHAR2(20),
    file_hash VARCHAR2(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT resumes_pkey PRIMARY KEY (id),
    CONSTRAINT fk_resumes_user FOREIGN KEY (user_id) REFERENCES auth.users (id)
);

CREATE INDEX idx_resumes_file_hash ON resumes(file_hash);
