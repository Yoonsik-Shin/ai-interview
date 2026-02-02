import asyncio
import json

from redis.exceptions import RedisError

from config import REDIS_BLOCKING_TIMEOUT, TTS_INPUT_QUEUE
from event.redis_client import create_redis_client
from service.worker.tts_request_worker import process_tts_event
from utils.log_format import log_json


async def run_consumer(redis_client, stop_event: asyncio.Event) -> None:
    log_json('tts_consumer_loop_started', queue=TTS_INPUT_QUEUE)

    while not stop_event.is_set():
        try:
            result = await redis_client.blpop(TTS_INPUT_QUEUE, timeout=REDIS_BLOCKING_TIMEOUT)
            if not result:
                continue
            _, message = result
            event = json.loads(message)
            log_json(
                'tts_event_received',
                interview_id=event.get('interviewId'),
                sentence_index=event.get('sentenceIndex'),
            )
            await process_tts_event(event, redis_client)
        except json.JSONDecodeError as exc:
            log_json('tts_event_parse_failed', error=str(exc))
        except (RedisError, TimeoutError) as exc:
            log_json('tts_consumer_error', error=str(exc), action='reconnect')
            try:
                await redis_client.close()
            except Exception:
                pass
            await asyncio.sleep(1)
            redis_client = await create_redis_client()
        except Exception as exc:
            log_json('tts_consumer_error', error=str(exc))
            await asyncio.sleep(1)
