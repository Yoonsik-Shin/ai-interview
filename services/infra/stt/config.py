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


def _env_float(name: str, default: float) -> float:
    value = _env(name)
    if value is None:
        return default
    try:
        return float(value)
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


PORT = _env_int("PORT", 8000)
STT_GRPC_PORT = _env_int("STT_GRPC_PORT", 50052)

OPENAI_API_KEY = _env("OPENAI_API_KEY", "")
OPENAI_REALTIME_MODEL = _env(
    "OPENAI_REALTIME_MODEL", "gpt-4o-realtime-preview-2024-12-17"
)

WHISPER_MODEL_SIZE = _env("WHISPER_MODEL_SIZE", "large-v3")
WHISPER_DEVICE = _env("WHISPER_DEVICE", "cuda") # Changed default to cuda assuming T4
WHISPER_COMPUTE_TYPE = _env("WHISPER_COMPUTE_TYPE", "int8")
WHISPER_BEAM_SIZE = _env_int("WHISPER_BEAM_SIZE", 5) # Reduced beam size for speed with large-v3
WHISPER_BEST_OF = _env_int("WHISPER_BEST_OF", 5)
WHISPER_TEMPERATURE = _env_float("WHISPER_TEMPERATURE", 0.0)
NO_SPEECH_THRESHOLD = _env_float("NO_SPEECH_THRESHOLD", 0.3)
COMPRESSION_RATIO_THRESHOLD = _env_float("COMPRESSION_RATIO_THRESHOLD", 2.4)
VAD_ENABLED = _env_bool("VAD_ENABLED", True)
VAD_MIN_SPEECH_MS = _env_int("VAD_MIN_SPEECH_MS", 300)   # More strict min speech
VAD_MIN_SILENCE_MS = _env_int("VAD_MIN_SILENCE_MS", 500) # Prevents mid-word splitting
VAD_SPEECH_PAD_MS = _env_int("VAD_SPEECH_PAD_MS", 50)    # Better padding padding for large model

SAMPLE_RATE = _env_int("SAMPLE_RATE", 16000)

SERVER_VAD_SILENCE_THRESHOLD = _env_float("SERVER_VAD_SILENCE_THRESHOLD", 0.01) # Legacy RMS threshold
SERVER_VAD_SILENCE_DURATION_SEC = _env_float("SERVER_VAD_SILENCE_DURATION_SEC", 0.5) # Reduced from 0.8
SERVER_VAD_MIN_SPEECH_SEC = _env_float("SERVER_VAD_MIN_SPEECH_SEC", 0.25)

# Silero VAD Settings (For potential backend use if not directly via faster-whisper)
SILERO_VAD_THRESHOLD = _env_float("SILERO_VAD_THRESHOLD", 0.6)
SILERO_VAD_MIN_SILENCE_DURATION_MS = _env_int("SILERO_VAD_MIN_SILENCE_DURATION_MS", 500)
SILERO_VAD_SPEECH_PAD_MS = _env_int("SILERO_VAD_SPEECH_PAD_MS", 50)

# Redis Configuration
REDIS_HOST = _env("REDIS_HOST", "redis-track1.unbrdn.svc.cluster.local")
REDIS_PORT = _env_int("REDIS_PORT", 6379)
REDIS_DB = _env_int("REDIS_DB", 0)
REDIS_PASSWORD = _env("REDIS_PASSWORD", None)

REDIS_TRACK3_HOST = _env("REDIS_TRACK3_HOST", "redis-track3.unbrdn.svc.cluster.local")
REDIS_TRACK3_PORT = _env_int("REDIS_TRACK3_PORT", 6379)
REDIS_TRACK3_SSL = _env_bool("REDIS_TRACK3_SSL", False)

REDIS_SENTINEL_HOSTS = _env("REDIS_SENTINEL_HOSTS", None)
REDIS_SENTINEL_HOST = _env("REDIS_SENTINEL_HOST", None)
REDIS_SENTINEL_PORT = _env_int("REDIS_SENTINEL_PORT", 26379)
REDIS_SENTINEL_NAME = _env("REDIS_SENTINEL_NAME", "mymaster")
STT_REDIS_CHANNEL = _env("STT_REDIS_CHANNEL", "interview:transcript:pubsub")
STT_PUBSUB_CHANNEL_TEMPLATE = _env("STT_PUBSUB_CHANNEL_TEMPLATE", "interview:transcript:pubsub:{interviewId}")
STT_REDIS_STREAM = _env("STT_REDIS_STREAM", "interview:transcript:process")

GRPC_PORT = STT_GRPC_PORT
