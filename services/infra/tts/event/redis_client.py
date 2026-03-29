from typing import Dict, List, Tuple

import socket
from redis.asyncio import Redis
from redis.asyncio.sentinel import Sentinel

from config import (
    REDIS_DB,
    REDIS_CONNECT_TIMEOUT,
    REDIS_HEALTH_CHECK_INTERVAL,
    REDIS_HOST,
    REDIS_PASSWORD,
    REDIS_PORT,
    REDIS_SENTINEL_HOSTS,
    REDIS_SENTINEL_NAME,
    REDIS_SOCKET_KEEPALIVE,
    REDIS_SOCKET_TIMEOUT,
    REDIS_TCP_KEEPCNT,
    REDIS_TCP_KEEPIDLE,
    REDIS_TCP_KEEPINTVL,
    REDIS_TRACK3_HOST,
    REDIS_TRACK3_PORT,
    REDIS_TRACK3_SSL,
)
from utils.log_format import log_json


def _parse_sentinel_hosts(hosts_env: str) -> List[Tuple[str, int]]:
    if not hosts_env:
        return []
    hosts: List[Tuple[str, int]] = []
    for entry in hosts_env.split(','):
        if ':' in entry:
            host, port = entry.rsplit(':', 1)
            hosts.append((host, int(port)))
        else:
            hosts.append((entry, 26379))
    return hosts


async def create_redis_client() -> Redis:
    keepalive_options: Dict[int, int] | None = None
    if REDIS_SOCKET_KEEPALIVE:
        keepalive_options = {
            socket.TCP_KEEPIDLE: REDIS_TCP_KEEPIDLE,
            socket.TCP_KEEPINTVL: REDIS_TCP_KEEPINTVL,
            socket.TCP_KEEPCNT: REDIS_TCP_KEEPCNT,
        }

    socket_timeout = REDIS_SOCKET_TIMEOUT if REDIS_SOCKET_TIMEOUT > 0 else None

    sentinel_hosts = _parse_sentinel_hosts(REDIS_SENTINEL_HOSTS)
    if sentinel_hosts:
        try:
            sentinel = Sentinel(
                sentinel_hosts,
                socket_timeout=socket_timeout,
                socket_connect_timeout=REDIS_CONNECT_TIMEOUT,
                password=REDIS_PASSWORD,
            )
            client: Redis = sentinel.master_for(
                REDIS_SENTINEL_NAME,
                db=REDIS_DB,
                password=REDIS_PASSWORD,
                decode_responses=True,
                socket_timeout=socket_timeout,
                socket_connect_timeout=REDIS_CONNECT_TIMEOUT,
                retry_on_timeout=True,
                health_check_interval=REDIS_HEALTH_CHECK_INTERVAL,
                socket_keepalive=REDIS_SOCKET_KEEPALIVE,
                socket_keepalive_options=keepalive_options,
            )
            await client.ping()
            log_json('redis_sentinel_connected', db=REDIS_DB)
            return client
        except Exception as exc:
            log_json('redis_sentinel_failed', error=str(exc))

    client = Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=REDIS_DB,
        password=REDIS_PASSWORD,
        decode_responses=True,
        socket_timeout=socket_timeout,
        socket_connect_timeout=REDIS_CONNECT_TIMEOUT,
        retry_on_timeout=True,
        health_check_interval=REDIS_HEALTH_CHECK_INTERVAL,
        socket_keepalive=REDIS_SOCKET_KEEPALIVE,
        socket_keepalive_options=keepalive_options,
    )
    await client.ping()
    log_json('redis_connected', host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)
    return client
async def create_track3_client() -> Redis:
    """Track 3 Redis (Azure Cache for Redis) 클라이언트 생성"""
    client = Redis(
        host=REDIS_TRACK3_HOST,
        port=REDIS_TRACK3_PORT,
        db=0, # Track 3 always uses DB 0
        password=REDIS_PASSWORD,
        ssl=REDIS_TRACK3_SSL,
        decode_responses=True,
        socket_connect_timeout=REDIS_CONNECT_TIMEOUT,
        retry_on_timeout=True,
        health_check_interval=REDIS_HEALTH_CHECK_INTERVAL,
    )
    await client.ping()
    log_json('redis_track3_connected', host=REDIS_TRACK3_HOST, port=REDIS_TRACK3_PORT)
    return client
