from datetime import datetime
import io

import edge_tts

from config import EDGE_RATE, EDGE_VOLUME, EDGE_VOICE_MAP
from utils.log_format import log_json


async def synthesize_edge(text: str, persona: str, rate: str = None, pitch: str = None) -> bytes:
    voice = EDGE_VOICE_MAP.get(persona, EDGE_VOICE_MAP['MAIN'])
    started_at = datetime.now()

    final_rate = rate or EDGE_RATE
    final_pitch = pitch or "+0Hz" # Default pitch if not provided

    log_json(
        'edge_tts_start',
        text_length=len(text),
        persona=persona,
        voice=voice,
        rate=final_rate,
        pitch=final_pitch,
        volume=EDGE_VOLUME,
    )

    try:
        communicate = edge_tts.Communicate(
            text=text,
            voice=voice,
            rate=final_rate,
            pitch=final_pitch,
            volume=EDGE_VOLUME,
        )
        audio_buffer = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk['type'] == 'audio':
                audio_buffer.write(chunk['data'])

        audio_buffer.seek(0)
        audio_bytes = audio_buffer.read()
        if not audio_bytes:
            raise RuntimeError('Edge-TTS returned empty audio')

        duration = (datetime.now() - started_at).total_seconds()
        log_json(
            'edge_tts_success',
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
            'edge_tts_failed',
            error=str(exc),
            text_length=len(text),
            generation_time=duration,
            persona=persona,
            voice=voice,
        )
        raise
