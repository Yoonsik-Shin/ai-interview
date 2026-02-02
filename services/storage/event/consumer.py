from typing import List, Optional
import redis
from redis.sentinel import Sentinel

from utils.log_format import log_json


def parse_sentinel_hosts(
    sentinel_hosts_env: str, sentinel_host_env: str, sentinel_port: int
) -> List[tuple[str, int]]:
    """
    Parse Sentinel hosts from environment variables

    Args:
        sentinel_hosts_env: Comma-separated list of host:port
        sentinel_host_env: Single sentinel host
        sentinel_port: Default sentinel port

    Returns:
        List of (host, port) tuples
    """
    hosts: List[tuple[str, int]] = []
    if sentinel_hosts_env:
        for entry in sentinel_hosts_env.split(","):
            entry = entry.strip()
            if not entry:
                continue
            if ":" in entry:
                host, port_str = entry.rsplit(":", 1)
                hosts.append((host, int(port_str)))
            else:
                hosts.append((entry, sentinel_port))
    elif sentinel_host_env:
        hosts.append((sentinel_host_env, sentinel_port))
    return hosts


def init_redis_client(
    host: str,
    port: int,
    db: int,
    password: Optional[str],
    sentinel_hosts_env: str = "",
    sentinel_host_env: str = "",
    sentinel_port: int = 26379,
    sentinel_name: str = "mymaster",
) -> redis.Redis:
    """
    Initialize Redis client with Sentinel support

    Args:
        host: Redis host
        port: Redis port
        db: Redis database number
        password: Redis password
        sentinel_hosts_env: Sentinel hosts environment variable
        sentinel_host_env: Single sentinel host environment variable
        sentinel_port: Sentinel port
        sentinel_name: Sentinel master name

    Returns:
        Redis client instance
    """
    sentinel_hosts = parse_sentinel_hosts(
        sentinel_hosts_env, sentinel_host_env, sentinel_port
    )

    if sentinel_hosts:
        try:
            sentinel_kwargs = {"password": password} if password else {}
            sentinel = Sentinel(
                sentinel_hosts, socket_timeout=5.0, sentinel_kwargs=sentinel_kwargs
            )
            client = sentinel.master_for(
                sentinel_name,
                db=db,
                password=password,
                socket_connect_timeout=5.0,
                socket_timeout=30.0,
                decode_responses=False,
            )
            client.ping()
            log_json(
                "redis_sentinel_connected",
                sentinel_hosts=sentinel_hosts,
                sentinel_name=sentinel_name,
                db=db,
            )
            return client
        except Exception as e:
            log_json(
                "redis_sentinel_connection_failed",
                error=str(e),
                sentinel_hosts=sentinel_hosts,
                sentinel_name=sentinel_name,
            )
            # Fall through to direct connection

    try:
        client = redis.Redis(
            host=host,
            port=port,
            db=db,
            password=password,
            socket_connect_timeout=5.0,
            socket_timeout=30.0,
            decode_responses=False,
        )
        client.ping()
        log_json("redis_connected", host=host, port=port, db=db)
        return client
    except redis.exceptions.ConnectionError as e:
        log_json("redis_connection_failed", error=str(e), host=host, port=port)
        raise
