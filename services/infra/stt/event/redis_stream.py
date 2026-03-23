"""
Redis Stream 발행 헬퍼
"""
from event.redis_pub import get_redis_client
import json

def publish_stream(stream_name: str, payload: dict):
    """Redis Stream 발행"""
    client = get_redis_client()
    client.xadd(stream_name, {"payload": json.dumps(payload)})
