import json
from event.redis_pub import get_redis_client


def publish_stream(stream: str, payload: dict) -> None:
    client = get_redis_client()
    # Core 서비스(Java)가 개별 필드를 기대하므로 딕셔너리를 직접 전달 (값은 문자열화)
    fields = {k: str(v) for k, v in payload.items()}
    client.xadd(stream, fields)
