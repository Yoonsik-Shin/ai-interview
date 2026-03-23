#!/usr/bin/env python3
"""
TTS Service - Redis Queue Consumer + gRPC Native Health Check
"""

import asyncio
import signal

import grpc
from grpc_health.v1 import health, health_pb2, health_pb2_grpc

from config import TTS_GRPC_PORT
from event.redis_client import create_redis_client
from service.tts_service import run_consumer
from utils.log_format import log_json


async def start_health_server() -> grpc.aio.Server:
    server = grpc.aio.server()
    health_servicer = health.HealthServicer()
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)
    health_servicer.set('', health_pb2.HealthCheckResponse.SERVING)
    server.add_insecure_port(f'[::]:{TTS_GRPC_PORT}')
    await server.start()
    log_json('health_server_started', port=TTS_GRPC_PORT)
    return server


async def main() -> None:
    log_json('tts_starting')
    redis_client = await create_redis_client()
    health_server = await start_health_server()

    stop_event = asyncio.Event()

    def _signal_handler() -> None:
        log_json('tts_shutdown_signal_received')
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, lambda *_: _signal_handler())

    consumer_task = asyncio.create_task(run_consumer(redis_client, stop_event))
    health_task = asyncio.create_task(health_server.wait_for_termination())

    done, pending = await asyncio.wait(
        {consumer_task, health_task},
        return_when=asyncio.FIRST_COMPLETED,
    )

    for task in pending:
        task.cancel()

    await health_server.stop(grace=5)
    await redis_client.close()
    log_json('tts_stopped')


if __name__ == '__main__':
    asyncio.run(main())
