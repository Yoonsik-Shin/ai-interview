"""
Redis Pub/Sub 헬퍼 (STT의 event/redis_pub.py 패턴)
"""
import redis
import json
from config import (
    REDIS_HOST, REDIS_PORT, REDIS_DB, REDIS_PASSWORD,
    REDIS_TRACK3_HOST, REDIS_TRACK3_PORT, REDIS_TRACK3_SSL
)


_redis_client = None
_track3_client = None


def get_redis_client():
    """Redis 클라이언트 (Track 1: Pub/Sub)"""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.Redis(
            host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, 
            password=REDIS_PASSWORD, decode_responses=False
        )
    return _redis_client


def get_track3_client():
    """Redis 클라이언트 (Track 3: Stream/Business Logic)"""
    global _track3_client
    if _track3_client is None:
        _track3_client = redis.Redis(
            host=REDIS_TRACK3_HOST, port=REDIS_TRACK3_PORT, 
            db=0, password=REDIS_PASSWORD, ssl=REDIS_TRACK3_SSL,
            decode_responses=False
        )
    return _track3_client


def publish_redis(channel: str, message: str):
    """Pub/Sub 발행"""
    client = get_redis_client()
    client.publish(channel, message)
