import os

from dotenv import load_dotenv

load_dotenv()


def _get_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {'1', 'true', 'yes', 'y'}


def _get_int(name: str, default: int) -> int:
    value = os.getenv(name)
    return int(value) if value else default


def _get_float(name: str, default: float) -> float:
    value = os.getenv(name)
    return float(value) if value else default


TTS_GRPC_PORT = _get_int('TTS_GRPC_PORT', 50053)

REDIS_HOST = os.getenv('REDIS_HOST', 'redis')
REDIS_PORT = _get_int('REDIS_PORT', 6379)
REDIS_DB = _get_int('REDIS_DB', 2)
REDIS_PASSWORD = os.getenv('REDIS_PASSWORD') or None
REDIS_SENTINEL_HOSTS = os.getenv('REDIS_SENTINEL_HOSTS', '')
REDIS_SENTINEL_NAME = os.getenv('REDIS_SENTINEL_NAME', 'mymaster')
REDIS_SOCKET_TIMEOUT = _get_int('REDIS_SOCKET_TIMEOUT', 0)
REDIS_CONNECT_TIMEOUT = _get_int('REDIS_CONNECT_TIMEOUT', 5)
REDIS_HEALTH_CHECK_INTERVAL = _get_int('REDIS_HEALTH_CHECK_INTERVAL', 30)
REDIS_SOCKET_KEEPALIVE = _get_bool('REDIS_SOCKET_KEEPALIVE', True)
REDIS_TCP_KEEPIDLE = _get_int('REDIS_TCP_KEEPIDLE', 30)
REDIS_TCP_KEEPINTVL = _get_int('REDIS_TCP_KEEPINTVL', 10)
REDIS_TCP_KEEPCNT = _get_int('REDIS_TCP_KEEPCNT', 3)
REDIS_BLOCKING_TIMEOUT = _get_int('REDIS_BLOCKING_TIMEOUT', 5)

TTS_SENTENCE_STREAM = os.getenv('TTS_SENTENCE_STREAM', 'interview:sentence:stream')
TTS_CONSUMER_GROUP = os.getenv('TTS_CONSUMER_GROUP', 'CG_TTS')
TTS_CONSUMER_NAME = os.getenv('TTS_CONSUMER_NAME', 'tts_worker_1')
TTS_PUBSUB_CHANNEL_TEMPLATE = os.getenv('TTS_PUBSUB_CHANNEL_TEMPLATE', 'interview:audio:{interviewId}')

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
OPENAI_TTS_MODEL = os.getenv('OPENAI_TTS_MODEL', 'tts-1')
OPENAI_TTS_SPEED = _get_float('OPENAI_TTS_SPEED', 1.0)

EDGE_TTS_ENABLED = _get_bool('EDGE_TTS_ENABLED', True)
EDGE_VOICE_DEFAULT = os.getenv('EDGE_TTS_VOICE', 'ko-KR-SunHiNeural')
EDGE_RATE = os.getenv('EDGE_TTS_RATE', '+0%')
EDGE_VOLUME = os.getenv('EDGE_TTS_VOLUME', '+0%')

OPENAI_VOICE_MAP = {
    'MAIN': os.getenv('TTS_OPENAI_VOICE_MAIN', 'alloy'),
    'TECH': os.getenv('TTS_OPENAI_VOICE_TECH', 'onyx'),
    'HR': os.getenv('TTS_OPENAI_VOICE_HR', 'nova'),
    'EXEC': os.getenv('TTS_OPENAI_VOICE_EXEC', 'echo'),
    # Legacy Fallback
    'PRESSURE': os.getenv('TTS_OPENAI_VOICE_PRESSURE', 'onyx'),
    'COMFORTABLE': os.getenv('TTS_OPENAI_VOICE_COMFORTABLE', 'nova'),
    'RANDOM': os.getenv('TTS_OPENAI_VOICE_RANDOM', 'alloy'),
}

EDGE_VOICE_MAP = {
    'MAIN': os.getenv('TTS_EDGE_VOICE_MAIN', 'ko-KR-SunHiNeural'),
    'TECH': os.getenv('TTS_EDGE_VOICE_TECH', 'ko-KR-InJoonNeural'),
    'HR': os.getenv('TTS_EDGE_VOICE_HR', 'ko-KR-SunHiNeural'),
    'EXEC': os.getenv('TTS_EDGE_VOICE_EXEC', 'ko-KR-InJoonNeural'),
    # Legacy Fallback
    'PRESSURE': os.getenv('TTS_EDGE_VOICE_PRESSURE', EDGE_VOICE_DEFAULT),
    'COMFORTABLE': os.getenv('TTS_EDGE_VOICE_COMFORTABLE', EDGE_VOICE_DEFAULT),
    'RANDOM': os.getenv('TTS_EDGE_VOICE_RANDOM', EDGE_VOICE_DEFAULT),
}
