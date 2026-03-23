"""
OpenAIEngine 구현체 (OpenAI Whisper/Realtime 기반)
"""

import asyncio
from engine.stt_engine import STTEngine
from engine.openai.openai_stt import transcribe_with_realtime_api


class OpenAIEngine(STTEngine):
    def transcribe(self, audio_chunks, mode, **kwargs):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        final_text = loop.run_until_complete(transcribe_with_realtime_api(audio_chunks))
        loop.close()
        return final_text, None, "openai-realtime-preview"
