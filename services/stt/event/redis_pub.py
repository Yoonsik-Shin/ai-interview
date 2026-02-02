import redis
from redis.sentinel import Sentinel
from config import (
    REDIS_HOST, REDIS_PORT, REDIS_DB, 
    REDIS_SENTINEL_HOSTS, REDIS_SENTINEL_HOST, 
    REDIS_SENTINEL_PORT, REDIS_SENTINEL_NAME,
    REDIS_PASSWORD
)

_redis_client = None


def get_redis_client():
    global _redis_client
    if _redis_client is None:
        # Check for Sentinel Configuration first
        sentinel_hosts = []
        if REDIS_SENTINEL_HOSTS:
            host_pairs = REDIS_SENTINEL_HOSTS.split(",")
            for pair in host_pairs:
                if ":" in pair:
                    h, p = pair.split(":")
                    sentinel_hosts.append((h.strip(), int(p.strip())))
        elif REDIS_SENTINEL_HOST:
            sentinel_hosts.append((REDIS_SENTINEL_HOST, int(REDIS_SENTINEL_PORT)))

        if sentinel_hosts and REDIS_SENTINEL_NAME:
            sentinel = Sentinel(sentinel_hosts, socket_timeout=0.1)
            _redis_client = sentinel.master_for(
                REDIS_SENTINEL_NAME, 
                socket_timeout=0.1, 
                password=REDIS_PASSWORD, 
                db=REDIS_DB, 
                decode_responses=True
            )
        else:
            # Fallback to direct connection
            _redis_client = redis.Redis(
                host=REDIS_HOST, 
                port=REDIS_PORT, 
                db=REDIS_DB, 
                password=REDIS_PASSWORD,
                decode_responses=True
            )
            
    return _redis_client


def publish_redis(channel: str, message: str):
    client = get_redis_client()
    client.publish(channel, message)
