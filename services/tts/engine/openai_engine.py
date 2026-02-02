from datetime import datetime

from openai import OpenAI

from config import OPENAI_API_KEY, OPENAI_TTS_MODEL, OPENAI_TTS_SPEED, OPENAI_VOICE_MAP
from utils.log_format import log_json

_openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


def synthesize_openai(text: str, persona: str, speed: float | None = None) -> bytes:
    if not _openai_client:
        raise RuntimeError('OPENAI_API_KEY is not configured')

    voice = OPENAI_VOICE_MAP.get(persona, OPENAI_VOICE_MAP['RANDOM'])
    speed_value = speed if speed is not None else OPENAI_TTS_SPEED
    started_at = datetime.now()

    log_json(
        'openai_tts_start',
        text_length=len(text),
        persona=persona,
        voice=voice,
        speed=speed_value,
        model=OPENAI_TTS_MODEL,
    )

    try:
        response = _openai_client.audio.speech.create(
            model=OPENAI_TTS_MODEL,
            voice=voice,
            input=text,
            speed=speed_value,
        )
        audio_bytes = getattr(response, 'content', None)
        if audio_bytes is None:
            audio_bytes = response.read()
        duration = (datetime.now() - started_at).total_seconds()
        log_json(
            'openai_tts_success',
            text_length=len(text),
            audio_size=len(audio_bytes),
            generation_time=duration,
            persona=persona,
            voice=voice,
        )
        return audio_bytes
    except Exception as exc:
        duration = (datetime.now() - started_at).total_seconds()
        log_json(
            'openai_tts_failed',
            error=str(exc),
            text_length=len(text),
            generation_time=duration,
            persona=persona,
            voice=voice,
        )
        raise
