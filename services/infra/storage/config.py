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


def _env_first(names: list[str], default: str) -> str:
    for name in names:
        value = _env(name)
        if value is not None and value != "":
            return value
    return default


# Service Configuration
PORT = _env_int("PORT", 8000)

# Redis Configuration
REDIS_HOST = _env("REDIS_HOST", "redis")
REDIS_PORT = _env_int("REDIS_PORT", 6379)
REDIS_DB = _env_int("REDIS_DB", 0)
REDIS_PASSWORD = _env("REDIS_PASSWORD", "") or None
REDIS_AUDIO_QUEUE_PREFIX = _env("REDIS_AUDIO_QUEUE_PREFIX", "interview:audio")

# Redis Sentinel Configuration
REDIS_SENTINEL_HOSTS = _env("REDIS_SENTINEL_HOSTS", "")
REDIS_SENTINEL_HOST = _env("REDIS_SENTINEL_HOST", "")
REDIS_SENTINEL_PORT = _env_int("REDIS_SENTINEL_PORT", 26379)
REDIS_SENTINEL_NAME = _env("REDIS_SENTINEL_NAME", "mymaster")

# Object Storage Configuration (OCI/S3 Compatible - local/dev)
OBJECT_STORAGE_ENDPOINT = _env("OBJECT_STORAGE_ENDPOINT", "")
OBJECT_STORAGE_PUBLIC_ENDPOINT = _env("OBJECT_STORAGE_PUBLIC_ENDPOINT", "")

# Azure Blob Storage Configuration (prod only)
AZURE_STORAGE_CONNECTION_STRING = _env("AZURE_STORAGE_CONNECTION_STRING", "")
AZURE_STORAGE_CONTAINER_NAME = _env("AZURE_STORAGE_CONTAINER_NAME", "")
AZURE_STORAGE_ACCOUNT_NAME = _env("AZURE_STORAGE_ACCOUNT_NAME", "")

# Diagnostic logging
print(f"DEBUG: OBJECT_STORAGE_ENDPOINT={OBJECT_STORAGE_ENDPOINT}")
print(f"DEBUG: OBJECT_STORAGE_PUBLIC_ENDPOINT={OBJECT_STORAGE_PUBLIC_ENDPOINT}")
OBJECT_STORAGE_ACCESS_KEY = _env("OBJECT_STORAGE_ACCESS_KEY", "")
OBJECT_STORAGE_SECRET_KEY = _env("OBJECT_STORAGE_SECRET_KEY", "")
OBJECT_STORAGE_BUCKET = _env("OBJECT_STORAGE_BUCKET", "interview-archives")
OBJECT_STORAGE_REGION = _env("OBJECT_STORAGE_REGION", "ap-seoul-1")
 
# MongoDB Configuration
MONGODB_URI = _env("MONGODB_URI", "mongodb://root:rootpassword@mongo.unbrdn.svc.cluster.local:27017/unbrdn?authSource=admin")
MONGODB_DB_NAME = _env("MONGODB_DB_NAME", "unbrdn")
MONGODB_COLLECTION = _env("MONGODB_COLLECTION", "interview_messages")

# Kafka Configuration
KAFKA_BROKER = _env("KAFKA_BROKER", "kafka:29092")
STORAGE_COMPLETED_TOPIC = _env("STORAGE_COMPLETED_TOPIC", "storage.completed")
INTERVIEW_MESSAGES_TOPIC = _env("INTERVIEW_MESSAGES_TOPIC", "interview.messages")
KAFKA_GROUP_ID = _env("KAFKA_GROUP_ID", "storage-service-group")

# Worker Configuration
QUEUE_SCAN_INTERVAL_SEC = _env_int("QUEUE_SCAN_INTERVAL_SEC", 10)
QUEUE_TIMEOUT_SEC = _env_int("QUEUE_TIMEOUT_SEC", 30)
