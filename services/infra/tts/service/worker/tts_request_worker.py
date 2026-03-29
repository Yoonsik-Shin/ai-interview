import base64
import json
from datetime import datetime
from typing import Any

from config import EDGE_TTS_ENABLED, TTS_PUBSUB_CHANNEL_TEMPLATE
from engine.edge_tts_engine import synthesize_edge
from engine.openai_engine import synthesize_openai
from utils.log_format import log_json


async def process_tts_event(event: dict[str, Any], redis_client) -> None:
    interview_id = event.get('interviewId')
    sentence = event.get('sentence', '')
    sentence_index = event.get('sentenceIndex', 0)
    persona = event.get('persona', 'COMFORTABLE')
    mode = event.get('mode', 'practice')
    trace_id = event.get('traceId')
    user_id = event.get('userId')
    turn_count = event.get('turnCount', 0)
    stage = event.get('stage', '')

    if not interview_id or not sentence:
        log_json('tts_event_missing_fields', interview_id=interview_id, sentence_index=sentence_index)
        return

    log_json(
        'tts_processing_start',
        interview_id=interview_id,
        sentence_index=sentence_index,
        mode=mode,
        persona=persona,
    )

    audio_bytes = None
    if mode == 'real':
        try:
            audio_bytes = await _synthesize_openai(sentence, persona)
        except Exception as exc:
            log_json('openai_tts_fallback', error=str(exc), interview_id=interview_id)

    if audio_bytes is None and EDGE_TTS_ENABLED:
        from config import EDGE_CUSTOM_SETTINGS
        settings = EDGE_CUSTOM_SETTINGS.get(persona, EDGE_CUSTOM_SETTINGS['MAIN'])
        audio_bytes = await synthesize_edge(
            sentence, 
            persona, 
            rate=settings.get('rate'), 
            pitch=settings.get('pitch')
        )

    if not audio_bytes:
        log_json('tts_generation_failed', interview_id=interview_id)
        return

    channel = TTS_PUBSUB_CHANNEL_TEMPLATE.format(interviewId=interview_id)
    payload = {
        'interviewId': interview_id,
        'sentenceIndex': sentence_index,
        'audioData': base64.b64encode(audio_bytes).decode('utf-8'),
        'timestamp': datetime.now().isoformat(),
        'persona': persona,
        'mode': mode,
        'text': sentence,
    }
    if trace_id:
        payload['traceId'] = trace_id
    if user_id:
        payload['userId'] = user_id

    await redis_client.publish(channel, json.dumps(payload, ensure_ascii=False))
    log_json(
        'tts_published',
        channel=channel,
        interview_id=interview_id,
        sentence_index=sentence_index,
        size=len(audio_bytes),
    )

    # Persistence: Push to Storage Queue
    queue_key = f"interview:audio:queue:storage:{interview_id}"
    storage_payload = {
        "interviewId": interview_id,
        "audioData": base64.b64encode(audio_bytes).decode('utf-8'),
        "metadata": {
            "role": "AI",
            "turnCount": turn_count,
            "sentenceIndex": sentence_index,
            "persona": persona,
            "stage": stage,
            "format": "mp3",  # edge-tts and openai-tts often return mp3
            "timestamp": datetime.now().isoformat()
        },
        "isFinal": True # Each sentence is a separate "final" chunk for storage
    }
    await redis_client.lpush(queue_key, json.dumps(storage_payload, ensure_ascii=False))
    log_json(
        'tts_pushed_to_storage_queue',
        queue_key=queue_key,
        interview_id=interview_id,
        sentence_index=sentence_index
    )


async def _synthesize_openai(text: str, persona: str) -> bytes:
    return await _run_blocking(synthesize_openai, text, persona)


async def _run_blocking(func, *args):
    import asyncio

    return await asyncio.to_thread(func, *args)
