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
        audio_bytes = await synthesize_edge(sentence, persona)

    if not audio_bytes:
        log_json('tts_generation_failed', interview_id=interview_id)
        return

    # interviewId를 사용하여 채널 이름 생성
    channel = f'interview:audio:{interview_id}'
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


async def _synthesize_openai(text: str, persona: str) -> bytes:
    return await _run_blocking(synthesize_openai, text, persona)


async def _run_blocking(func, *args):
    import asyncio

    return await asyncio.to_thread(func, *args)
