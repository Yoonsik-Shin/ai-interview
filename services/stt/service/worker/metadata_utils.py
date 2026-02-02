from config import SAMPLE_RATE


def extract_metadata(chunk) -> dict:
    """
    최초 오디오 청크에서 인터뷰/유저/트레이스 등 메타데이터 추출
    """
    return {
        "interview_id": chunk.interview_id,
        "user_id": chunk.user_id,
        "trace_id": chunk.trace_id,
        "audio_format": chunk.audio_format or "pcm16",
        "sample_rate": chunk.sample_rate or SAMPLE_RATE,
        "input_gain": chunk.input_gain or 1.0,
        "client_threshold_percent": chunk.threshold or 5.0,
        "mode": chunk.mode or "practice",
    }
