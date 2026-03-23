CREATE TABLE pg_provider (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pg_provider_pkey PRIMARY KEY (id),
    CONSTRAINT pg_provider_name_key UNIQUE (name)
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

CREATE TABLE wallet (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    free_credits integer NOT NULL,
    paid_credits integer NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    CONSTRAINT wallet_pkey PRIMARY KEY (id),
    CONSTRAINT wallet_user_id_key UNIQUE (user_id),
    CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES auth.users (id)
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
    CONSTRAINT fk_subscription_user FOREIGN KEY (user_id) REFERENCES auth.users (id),
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
    CONSTRAINT fk_payment_user FOREIGN KEY (user_id) REFERENCES auth.users (id),
    CONSTRAINT fk_payment_pg_provider FOREIGN KEY (pg_provider_id) REFERENCES pg_provider (id)
);

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
    CONSTRAINT fk_inventory_user FOREIGN KEY (user_id) REFERENCES auth.users (id),
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
    CONSTRAINT fk_puh_user FOREIGN KEY (user_id) REFERENCES auth.users (id),
    CONSTRAINT fk_puh_product FOREIGN KEY (product_id) REFERENCES product (id)
);
