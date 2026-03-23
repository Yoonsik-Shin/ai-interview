import * as Joi from "joi";

/** 환경변수 유효성 검사 스키마 */
export const envValidationSchema = Joi.object({
    // Server Configuration
    NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
    PORT: Joi.number().default(3001),

    // Redis Configuration
    REDIS_HOST: Joi.string().required(),
    REDIS_PORT: Joi.number().default(6379),
    REDIS_PASSWORD: Joi.string().allow("").optional(),
    REDIS_SENTINEL_HOSTS: Joi.string().optional(),
    REDIS_SENTINEL_HOST: Joi.string().optional(),
    REDIS_SENTINEL_PORT: Joi.number().optional(),
    REDIS_SENTINEL_NAME: Joi.string().optional(),

    // gRPC Configuration
    CORE_GRPC_HOST: Joi.string().default("core"),
    CORE_GRPC_PORT: Joi.number().default(9090),
    STT_GRPC_HOST: Joi.string().default("stt"),
    STT_GRPC_PORT: Joi.number().default(50052),

    // JWT/JWKS Configuration
    JWT_JWKS_URI: Joi.string().required(),
    JWT_ALGORITHM: Joi.string().default("RS256"),
    JWT_JWKS_CACHE_MAX_AGE_MS: Joi.number().default(3600000), // 1 hour
    JWT_JWKS_TIMEOUT_MS: Joi.number().default(5000), // 5 seconds
    JWT_JWKS_REQUESTS_PER_MINUTE: Joi.number().default(5),
});
