"""
Whisper engine integration.
- Faster-Whisper 모델 로딩 및 음성 인식
- VAD(Voice Activity Detection) 옵션 및 폴백 처리
"""

from typing import Any
import numpy as np
from faster_whisper import WhisperModel
from config import (
    WHISPER_MODEL_SIZE,
    WHISPER_DEVICE,
    WHISPER_COMPUTE_TYPE,
    WHISPER_BEAM_SIZE,
    WHISPER_BEST_OF,
    WHISPER_TEMPERATURE,
    VAD_ENABLED,
    VAD_MIN_SPEECH_MS,
    VAD_MIN_SILENCE_MS,
    VAD_SPEECH_PAD_MS,
)
from utils.log_format import log_json


def _log(event: str, **fields) -> None:
    log_json(event, service="stt-grpc", **fields)


_whisper_model: WhisperModel | None = None


def init_whisper_model() -> WhisperModel:
    """
    Whisper 모델을 메모리에 로딩(최초 1회), 이후 캐싱하여 재사용
    """
    global _whisper_model
    if _whisper_model is None:
        _log(
            "whisper_model_loading",
            model=WHISPER_MODEL_SIZE,
            device=WHISPER_DEVICE,
        )
        _whisper_model = WhisperModel(
            WHISPER_MODEL_SIZE,
            device=WHISPER_DEVICE,
            compute_type=WHISPER_COMPUTE_TYPE,
            download_root="/app/.cache",
        )
        _log("whisper_model_loaded")
    return _whisper_model


def transcribe_with_whisper(
    samples: np.ndarray,
    *,
    language: str = "ko",
    beam_size: int = WHISPER_BEAM_SIZE,
    best_of: int = WHISPER_BEST_OF,
    temperature: float = WHISPER_TEMPERATURE,
    vad_enabled: bool = VAD_ENABLED,
    vad_parameters: dict[str, Any] | None = None,
    allow_vad_fallback: bool = True,
) -> tuple[str, Any, Any | None]:
    """
    Whisper 모델로 음성 인식 수행. VAD(Voice Activity Detection) 옵션 지원.
    인식 결과가 없고 VAD가 활성화된 경우, VAD 없이 폴백 재시도.
    Returns (text, info, fallback_info)
    """
    model = init_whisper_model()
    samples = samples.astype(np.float32)

    if vad_parameters is None:
        vad_parameters = dict(
            min_speech_duration_ms=VAD_MIN_SPEECH_MS,
            min_silence_duration_ms=VAD_MIN_SILENCE_MS,
            speech_pad_ms=VAD_SPEECH_PAD_MS,
        )

    segments, info = model.transcribe(
        samples,
        language=language,
        beam_size=beam_size,
        best_of=best_of,
        temperature=temperature,
        vad_filter=vad_enabled,
        vad_parameters=vad_parameters,
        condition_on_previous_text=False,
    )

    text_parts = [segment.text.strip() for segment in segments]
    final_text = " ".join(text_parts).strip()

    fallback_info = None
    if allow_vad_fallback and vad_enabled and len(final_text) == 0:
        _log("whisper_vad_fallback_triggered")
        try:
            segments2, info2 = model.transcribe(
                samples,
                language=language,
                beam_size=max(4, beam_size // 2),
                best_of=max(2, best_of // 2),
                vad_filter=False,
                condition_on_previous_text=False,
            )
            final_text = " ".join([s.text.strip() for s in segments2]).strip()
            fallback_info = info2
            _log(
                "whisper_vad_fallback_complete",
                text_length=len(final_text),
                language=info2.language,
                language_probability=info2.language_probability,
            )
        except Exception as exc:
            _log("whisper_vad_fallback_error", error=str(exc))

    return final_text, info, fallback_info
