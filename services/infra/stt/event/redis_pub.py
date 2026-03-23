"""
Redis Pub/Sub 헬퍼 (STT의 event/redis_pub.py 패턴)
"""
import redis
import json
from config import REDIS_HOST, REDIS_PORT, REDIS_DB


_redis_client = None


def get_redis_client():
    """Redis 클라이언트 싱글톤"""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.Redis(
            host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, decode_responses=False
        )
    return _redis_client


def publish_redis(channel: str, message: str):
    """Pub/Sub 발행"""
    client = get_redis_client()
    client.publish(channel, message)
