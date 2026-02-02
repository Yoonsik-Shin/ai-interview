"""
오디오 전처리 및 RMS 계산 유틸리티
"""

import numpy as np
from config import SAMPLE_RATE
from utils.log_format import log_json


def _log(event: str, **fields) -> None:
    log_json(event, service="stt-grpc", **fields)


def calculate_chunk_rms(audio_bytes: bytes) -> float:
    if len(audio_bytes) < 2:
        return 0.0
    samples = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    if len(samples) == 0:
        return 0.0
    return float(np.sqrt(np.mean(samples**2)))


def preprocess_audio(
    audio_bytes: bytes,
    audio_format: str,
    input_gain: float = 1.0,
    client_threshold_percent: float = 5.0,
) -> np.ndarray:
    """Minimal audio preprocessing to avoid distortion."""
    if audio_format == "pcm16":
        samples = (
            np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        )

        rms = np.sqrt(np.mean(samples**2))
        if rms < 0.001:
            _log("audio_too_quiet", rms=float(rms))
            return np.zeros_like(samples)

        target_rms = 0.1
        if rms > 0:
            gain = target_rms / rms
            gain = np.clip(gain, 0.3, 3.0)
            samples = (samples * gain).astype(np.float32)
            _log("audio_normalized", original_rms=float(rms), applied_gain=float(gain))

        peak = np.max(np.abs(samples))
        if peak > 0.95:
            samples = samples * (0.95 / peak)
            _log("audio_clipping_prevented", peak=float(peak))

        final_rms = np.sqrt(np.mean(samples**2))
        non_zero_ratio = np.sum(np.abs(samples) > 0.01) / len(samples)
        # _log(
        #     "audio_debug_info",
        #     final_rms=float(final_rms),
        #     peak=float(np.max(np.abs(samples))),
        #     duration_sec=float(len(samples) / SAMPLE_RATE),
        #     non_zero_ratio=float(non_zero_ratio),
        #     sample_count=len(samples),
        # )

        return samples.astype(np.float32)

    _log("unsupported_audio_format", format=audio_format)
    return np.zeros(SAMPLE_RATE, dtype=np.float32)
