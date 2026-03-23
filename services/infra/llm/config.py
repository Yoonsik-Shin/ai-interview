import os
from dotenv import load_dotenv

load_dotenv()


def _env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    return default if value is None else value


def _env_int(name: str, default: int) -> int:
    value = _env(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _env_bool(name: str, default: bool = False) -> bool:
    value = _env(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


# gRPC Settings
GRPC_PORT = _env_int("GRPC_PORT", 50051)

# OpenAI Settings
OPENAI_API_KEY = _env("OPENAI_API_KEY", "")
OPENAI_MODEL = _env("OPENAI_MODEL", "gpt-4o-mini")

# Redis Settings
REDIS_HOST = _env("REDIS_HOST", "redis")
REDIS_PORT = _env_int("REDIS_PORT", 6379)
REDIS_DB = _env_int("REDIS_DB", 1)
REDIS_PASSWORD = _env("REDIS_PASSWORD", "") or None
REDIS_TRACK2_URL = _env("REDIS_TRACK2_URL", "")
if not REDIS_TRACK2_URL:
    auth_part = f":{REDIS_PASSWORD}@" if REDIS_PASSWORD else ""
    REDIS_TRACK2_URL = f"redis://{auth_part}{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"

# Redis Sentinel Configuration
REDIS_SENTINEL_HOSTS = _env("REDIS_SENTINEL_HOSTS", "")
REDIS_SENTINEL_HOST = _env("REDIS_SENTINEL_HOST", "")
REDIS_SENTINEL_PORT = _env_int("REDIS_SENTINEL_PORT", 26379)
REDIS_SENTINEL_NAME = _env("REDIS_SENTINEL_NAME", "mymaster")

# Redis Queue (TTS)
TTS_QUEUE = _env("TTS_QUEUE", "tts:sentence:queue")

# System Prompt
SYSTEM_PROMPT = _env(
    "SYSTEM_PROMPT",
    "너는 10년 차 IT 개발자 면접관이다. "
    "지원자의 답변을 듣고, 내용이 빈약하거나 기술적으로 모호한 부분을 찾아 "
    "날카로운 꼬리 질문을 한 가지만 짧게(한 문장으로) 물어봐라. "
    "존댓말을 사용해라.",
)

# External Tools
TAVILY_API_KEY = _env("TAVILY_API_KEY", "")

# PostgreSQL settings (for PGVector)
DB_HOST = _env("DB_HOST", "localhost")
DB_PORT = _env_int("DB_PORT", 5432)
DB_USER = _env("DB_USER", "postgres")
DB_PASSWORD = _env("DB_PASSWORD", "postgres")
DB_NAME = _env("DB_NAME", "unbrdn")
DB_URL = _env("DB_URL", f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}")

# External Services
RESUME_SERVICE_HOST = _env("RESUME_SERVICE_HOST", "localhost")
RESUME_SERVICE_PORT = _env_int("RESUME_SERVICE_PORT", 9090)
