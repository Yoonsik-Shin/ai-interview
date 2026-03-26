-- phone_number nullable (OAuth 유저는 complete-profile에서 입력)
ALTER TABLE users ALTER COLUMN phone_number DROP NOT NULL;

-- 유저 연동 소셜로그인 플랫폼 테이블 (UserOauthsJpaEntity 복합 PK 구조에 맞춤)
CREATE TABLE user_oauths (
    user_id          uuid          NOT NULL,
    provider_id      uuid          NOT NULL,
    provider_user_id varchar(255)  NOT NULL,
    access_token     varchar(2048) NOT NULL,
    token_expires_at timestamp     NOT NULL,
    CONSTRAINT user_oauths_pkey PRIMARY KEY (user_id, provider_id),
    CONSTRAINT fk_user_oauths_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_user_oauths_provider FOREIGN KEY (provider_id) REFERENCES oauth_provider (id),
    CONSTRAINT user_oauths_provider_user_unique UNIQUE (provider_id, provider_user_id)
);

-- GOOGLE provider 시드 데이터 (oauth_provider 테이블은 V001에서 이미 생성됨)
INSERT INTO oauth_provider (id, company_name)
VALUES (gen_random_uuid(), 'GOOGLE')
ON CONFLICT (company_name) DO NOTHING;
