import * as Joi from "joi";

/** 환경변수 유효성 검사 스키마 */
export const envValidationSchema = Joi.object({
    // Server Configuration
    NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
    PORT: Joi.number().default(3000),

    // Redis Configuration
    REDIS_HOST: Joi.string().required(),
    REDIS_PORT: Joi.number().default(6379),
    REDIS_PASSWORD: Joi.string().allow("").optional(),
    REDIS_SENTINEL_HOSTS: Joi.string().optional(),
    REDIS_SENTINEL_HOST: Joi.string().optional(),
    REDIS_SENTINEL_PORT: Joi.number().optional(),
    REDIS_SENTINEL_NAME: Joi.string().optional(),

    // JWT / Auth Configuration
    JWT_JWKS_URI: Joi.string().required(),
    JWT_JWKS_CACHE_MAX_AGE_MS: Joi.number().default(300000), // 5 minutes
    JWT_JWKS_REQUESTS_PER_MINUTE: Joi.number().default(10),
    JWT_JWKS_TIMEOUT_MS: Joi.number().default(30000), // 30 seconds

    // Google OAuth Configuration
    GOOGLE_CLIENT_ID: Joi.string().required(),
    GOOGLE_CLIENT_SECRET: Joi.string().required(),
    GOOGLE_CALLBACK_URL: Joi.string().required(),
    FRONTEND_URL: Joi.string().required(),

    // gRPC Configuration
    CORE_GRPC_HOST: Joi.string().default("core"),
    CORE_GRPC_PORT: Joi.number().default(9090),
    LLM_GRPC_HOST: Joi.string().default("llm"),
    LLM_GRPC_PORT: Joi.number().default(50051),
});
