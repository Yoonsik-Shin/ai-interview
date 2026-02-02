"""
WhisperEngine 구현체 (Faster-Whisper 기반)
"""

from engine.stt_engine import STTEngine
from engine.whisper.whisper_stt import init_whisper_model, transcribe_with_whisper


class WhisperEngine(STTEngine):
    def transcribe(self, audio_chunks, mode, **kwargs):
        init_whisper_model()
        samples = kwargs["preprocess_audio"](
            b"".join(audio_chunks),
            kwargs.get("audio_format", "pcm16"),
            kwargs.get("input_gain", 1.0),
            kwargs.get("client_threshold_percent", 5.0),
        )
        final_text, info, _fallback_info = transcribe_with_whisper(samples)
        return final_text, info, "faster-whisper"
