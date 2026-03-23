from config import (
    SERVER_VAD_MIN_SPEECH_SEC,
    SERVER_VAD_SILENCE_DURATION_SEC,
    SERVER_VAD_SILENCE_THRESHOLD,
)


def vad_update(
    chunk_rms: float,
    chunk_samples: int,
    sample_rate: int,
    has_speech: bool,
    total_speech_samples: int,
    silence_start_time,
    time_module,
) -> tuple:
    """
    VAD(음성 감지) 상태 갱신 및 자동 finalize 판단
    """
    if chunk_rms > SERVER_VAD_SILENCE_THRESHOLD:
        has_speech = True
        total_speech_samples += chunk_samples
        silence_start_time = None
        auto_finalize = False
    else:
        current_time = time_module.time()

        if silence_start_time is None:
            silence_start_time = current_time

        silence_duration = current_time - silence_start_time
        min_speech_samples = int(SERVER_VAD_MIN_SPEECH_SEC * sample_rate)
        auto_finalize = False

        if has_speech and total_speech_samples >= min_speech_samples:
            if silence_duration >= SERVER_VAD_SILENCE_DURATION_SEC:
                auto_finalize = True

    return has_speech, total_speech_samples, silence_start_time, auto_finalize
