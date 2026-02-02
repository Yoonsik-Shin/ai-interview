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

WHISPER_MODEL_SIZE = _env("WHISPER_MODEL_SIZE", "small")
WHISPER_DEVICE = _env("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = _env("WHISPER_COMPUTE_TYPE", "int8")
WHISPER_BEAM_SIZE = _env_int("WHISPER_BEAM_SIZE", 10)
WHISPER_BEST_OF = _env_int("WHISPER_BEST_OF", 5)
WHISPER_TEMPERATURE = _env_float("WHISPER_TEMPERATURE", 0.0)
NO_SPEECH_THRESHOLD = _env_float("NO_SPEECH_THRESHOLD", 0.3)
COMPRESSION_RATIO_THRESHOLD = _env_float("COMPRESSION_RATIO_THRESHOLD", 2.4)
VAD_ENABLED = _env_bool("VAD_ENABLED", True)
VAD_MIN_SPEECH_MS = _env_int("VAD_MIN_SPEECH_MS", 250)
VAD_MIN_SILENCE_MS = _env_int("VAD_MIN_SILENCE_MS", 300)
VAD_SPEECH_PAD_MS = _env_int("VAD_SPEECH_PAD_MS", 30)

SAMPLE_RATE = _env_int("SAMPLE_RATE", 16000)

SERVER_VAD_SILENCE_THRESHOLD = _env_float("SERVER_VAD_SILENCE_THRESHOLD", 0.01)
SERVER_VAD_SILENCE_DURATION_SEC = _env_float("SERVER_VAD_SILENCE_DURATION_SEC", 0.8)
SERVER_VAD_MIN_SPEECH_SEC = _env_float("SERVER_VAD_MIN_SPEECH_SEC", 0.3)

KAFKA_BROKER = _env("KAFKA_BROKER", "kafka:29092")
KAFKA_ENABLED = _env_bool("KAFKA_ENABLED", False)
INPUT_TOPIC = _env_first(["STT_INPUT_TOPIC", "INPUT_TOPIC"], "interview.audio.input")
OUTPUT_TOPIC = _env_first(
    ["STT_OUTPUT_TOPIC", "OUTPUT_TOPIC"], "interview.stt.transcript.created.v1"
)

REDIS_HOST = _env("REDIS_HOST", "redis")
REDIS_PORT = _env_int("REDIS_PORT", 6379)
REDIS_DB = _env_int("REDIS_DB", 1)
REDIS_PASSWORD = _env("REDIS_PASSWORD", None)

REDIS_SENTINEL_HOSTS = _env("REDIS_SENTINEL_HOSTS", None)
REDIS_SENTINEL_HOST = _env("REDIS_SENTINEL_HOST", None)
REDIS_SENTINEL_PORT = _env_int("REDIS_SENTINEL_PORT", 26379)
REDIS_SENTINEL_NAME = _env("REDIS_SENTINEL_NAME", "mymaster")
STT_REDIS_CHANNEL = _env("STT_REDIS_CHANNEL", "stt:transcript:pubsub")
STT_REDIS_STREAM = _env("STT_REDIS_STREAM", "stt:transcript:stream")

GRPC_PORT = STT_GRPC_PORT
