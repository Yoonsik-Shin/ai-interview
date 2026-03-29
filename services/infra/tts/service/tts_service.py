import asyncio
import json

from redis.exceptions import RedisError

from config import REDIS_BLOCKING_TIMEOUT, TTS_SENTENCE_STREAM, TTS_CONSUMER_GROUP, TTS_CONSUMER_NAME
from event.redis_client import create_redis_client, create_track3_client
from service.worker.tts_request_worker import process_tts_event
from utils.log_format import log_json


async def run_consumer(track1_client, track3_client, stop_event: asyncio.Event) -> None:
    log_json('tts_consumer_loop_started', stream=TTS_SENTENCE_STREAM, group=TTS_CONSUMER_GROUP)

    try:
        await track3_client.xgroup_create(TTS_SENTENCE_STREAM, TTS_CONSUMER_GROUP, id='0', mkstream=True)
    except Exception:
        pass  # Group already exists

    while not stop_event.is_set():
        try:
            results = await track3_client.xreadgroup(
                groupname=TTS_CONSUMER_GROUP,
                consumername=TTS_CONSUMER_NAME,
                streams={TTS_SENTENCE_STREAM: '>'},
                count=1,
                block=REDIS_BLOCKING_TIMEOUT * 1000
            )

            if not results:
                continue

            for stream_key, messages in results:
                for message_id, message in messages:
                    # Message is a dictionary from XADD
                    event = {
                        'interviewId': message.get('interviewId'),
                        'persona': message.get('personaId', 'DEFAULT'),
                        'sentenceIndex': int(message.get('sentenceIndex', 0)),
                        'sentence': message.get('sentence', ''),
                        'isFinal': message.get('isFinal', 'false').lower() == 'true',
                        'mode': message.get('mode', 'practice'),
                        'turnCount': int(message.get('turnCount', 0)),
                        'stage': message.get('stage', ''),
                    }

                    # log_json(
                    #     'tts_event_received',
                    #     interview_id=event.get('interviewId'),
                    #     sentence_index=event.get('sentenceIndex'),
                    #     message_id=message_id
                    # )
                    
                    await process_tts_event(event, track1_client)
                    await track3_client.xack(TTS_SENTENCE_STREAM, TTS_CONSUMER_GROUP, message_id)

        except json.JSONDecodeError as exc:
            log_json('tts_event_parse_failed', error=str(exc))
        except (RedisError, TimeoutError) as exc:
            log_json('tts_consumer_error', error=str(exc), action='reconnect')
            try:
                await track3_client.close()
            except Exception:
                pass
            await asyncio.sleep(1)
            track1_client = await create_redis_client()
            track3_client = await create_track3_client()
        except Exception as exc:
            log_json('tts_consumer_error', error=str(exc))
            await asyncio.sleep(1)
