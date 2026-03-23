CREATE TABLE pg_provider (
    id RAW(16) NOT NULL,
    name VARCHAR2(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT pg_provider_pkey PRIMARY KEY (id),
    CONSTRAINT pg_provider_name_key UNIQUE (name)
);

CREATE TABLE plan (
    id RAW(16) NOT NULL,
    name VARCHAR2(100) NOT NULL,
    price NUMBER(10) NOT NULL,
    description CLOB,
    deprecated_at TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT plan_pkey PRIMARY KEY (id),
    CONSTRAINT plan_name_key UNIQUE (name)
);

CREATE TABLE "package" (
    id RAW(16) NOT NULL,
    name VARCHAR2(255) NOT NULL,
    price NUMBER(10) NOT NULL,
    description CLOB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT package_pkey PRIMARY KEY (id)
);

CREATE TABLE product (
    id RAW(16) NOT NULL,
    name VARCHAR2(255) NOT NULL,
    type VARCHAR2(20) NOT NULL,
    price NUMBER(10) NOT NULL,
    currency VARCHAR2(10) NOT NULL,
    description CLOB,
    deprecated_at TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT product_pkey PRIMARY KEY (id)
);

CREATE TABLE plan_quota (
    id RAW(16) NOT NULL,
    plan_id RAW(16) NOT NULL,
    quota_name VARCHAR2(100) NOT NULL,
    quota_amount NUMBER(10) NOT NULL,
    quota_unit VARCHAR2(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT plan_quota_pkey PRIMARY KEY (id),
    CONSTRAINT fk_plan_quota_plan FOREIGN KEY (plan_id) REFERENCES plan (id)
);

CREATE TABLE package_content (
    id RAW(16) NOT NULL,
    package_id RAW(16) NOT NULL,
    product_id RAW(16) NOT NULL,
    quantity NUMBER(10) NOT NULL,
    CONSTRAINT package_content_pkey PRIMARY KEY (id),
    CONSTRAINT fk_package_content_package FOREIGN KEY (package_id) REFERENCES "package" (id),
    CONSTRAINT fk_package_content_product FOREIGN KEY (product_id) REFERENCES product (id)
);

CREATE TABLE wallet (
    id RAW(16) NOT NULL,
    user_id RAW(16) NOT NULL,
    free_credits NUMBER(10) NOT NULL,
    paid_credits NUMBER(10) NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    CONSTRAINT wallet_pkey PRIMARY KEY (id),
    CONSTRAINT wallet_user_id_key UNIQUE (user_id),
    CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES auth.users (id)
);

CREATE TABLE subscription (
    id RAW(16) NOT NULL,
    user_id RAW(16) NOT NULL,
    plan_id RAW(16) NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,
    is_active NUMBER(1) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT subscription_pkey PRIMARY KEY (id),
    CONSTRAINT fk_subscription_user FOREIGN KEY (user_id) REFERENCES auth.users (id),
    CONSTRAINT fk_subscription_plan FOREIGN KEY (plan_id) REFERENCES plan (id)
);

CREATE TABLE subscription_usages (
    id RAW(16) NOT NULL,
    subscription_id RAW(16) NOT NULL,
    quota_name VARCHAR2(100) NOT NULL,
    used_amount NUMBER(10) NOT NULL,
    usage_month VARCHAR2(7) NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    CONSTRAINT subscription_usages_pkey PRIMARY KEY (id),
    CONSTRAINT fk_subscription_usages_subscription FOREIGN KEY (subscription_id) REFERENCES subscription (id)
);

CREATE TABLE payment (
    id RAW(16) NOT NULL,
    user_id RAW(16) NOT NULL,
    pg_provider_id RAW(16) NOT NULL,
    amount NUMBER(10) NOT NULL,
    currency VARCHAR2(10) NOT NULL,
    status VARCHAR2(20) NOT NULL,
    pg_transaction_id VARCHAR2(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT payment_pkey PRIMARY KEY (id),
    CONSTRAINT payment_pg_transaction_id_key UNIQUE (pg_transaction_id),
    CONSTRAINT fk_payment_user FOREIGN KEY (user_id) REFERENCES auth.users (id),
    CONSTRAINT fk_payment_pg_provider FOREIGN KEY (pg_provider_id) REFERENCES pg_provider (id)
);

CREATE TABLE credit_transaction (
    id RAW(16) NOT NULL,
    wallet_id RAW(16) NOT NULL,
    amount NUMBER(10) NOT NULL,
    type VARCHAR2(20) NOT NULL,
    reference_type VARCHAR2(50) NOT NULL,
    reference_id VARCHAR2(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT credit_transaction_pkey PRIMARY KEY (id),
    CONSTRAINT fk_credit_transaction_wallet FOREIGN KEY (wallet_id) REFERENCES wallet (id)
);

CREATE TABLE inventory (
    id RAW(16) NOT NULL,
    user_id RAW(16) NOT NULL,
    product_id RAW(16) NOT NULL,
    total_count NUMBER(10) NOT NULL,
    remaining_count NUMBER(10) NOT NULL,
    expired_at TIMESTAMP NOT NULL,
    status VARCHAR2(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT inventory_pkey PRIMARY KEY (id),
    CONSTRAINT fk_inventory_user FOREIGN KEY (user_id) REFERENCES auth.users (id),
    CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES product (id)
);

CREATE TABLE product_usage_history (
    id RAW(16) NOT NULL,
    user_id RAW(16) NOT NULL,
    product_id RAW(16) NOT NULL,
    source_type VARCHAR2(20) NOT NULL,
    amount NUMBER(10) NOT NULL,
    reference_id VARCHAR2(255) NOT NULL,
    reference_type VARCHAR2(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT product_usage_history_pkey PRIMARY KEY (id),
    CONSTRAINT fk_puh_user FOREIGN KEY (user_id) REFERENCES auth.users (id),
    CONSTRAINT fk_puh_product FOREIGN KEY (product_id) REFERENCES product (id)
);
