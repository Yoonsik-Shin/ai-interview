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

# OpenAI Settings (local/dev)
OPENAI_API_KEY = _env("OPENAI_API_KEY", "")
OPENAI_MODEL = _env("OPENAI_MODEL", "gpt-4o-mini")

# Azure OpenAI Settings (prod only - if all three are set, AzureChatOpenAI is used)
AZURE_OPENAI_API_KEY = _env("AZURE_OPENAI_API_KEY", "")
AZURE_OPENAI_ENDPOINT = _env("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_DEPLOYMENT_ID = _env("AZURE_OPENAI_DEPLOYMENT_ID", "")

# Redis Settings
REDIS_HOST = _env("REDIS_HOST", "redis")
REDIS_PORT = _env_int("REDIS_PORT", 6379)
REDIS_DB = _env_int("REDIS_DB", 0)
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

# Redis Streams (TTS)
TTS_SENTENCE_STREAM = _env("TTS_SENTENCE_STREAM", "interview:sentence:generate")

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
RESUME_SERVICE_HOST = _env("RESUME_SERVICE_HOST", "resume")
# Kubernetes 서비스 자동 주입(8081)보다 gRPC 포트(9090)를 우선적으로 사용하도록 설계
_grpc_port = _env_int("RESUME_SERVICE_PORT_GRPC", 9090)
RESUME_SERVICE_PORT = _env_int("RESUME_SERVICE_PORT", _grpc_port)
# 만약 RESUME_SERVICE_PORT가 8081(K8s 자동 주입 HTTP 포트)이라면, 명시적으로 9090(gRPC)을 사용
if RESUME_SERVICE_PORT == 8081:
    RESUME_SERVICE_PORT = 9090
