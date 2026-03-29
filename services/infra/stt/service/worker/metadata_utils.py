from config import SAMPLE_RATE


def extract_metadata(chunk) -> dict:
    """
    AudioChunk에서 메타데이터 추출 (새로운 AudioContext 구조)
    """
    ctx = chunk.context
    
    # oneof context_type 처리
    interview_id = None
    user_id = None
    stage = None
    
    if ctx.HasField('interview'):
        interview_id = ctx.interview.interview_id
        user_id = ctx.interview.user_id
        stage = ctx.interview.stage or "unknown"
        retry_count = ctx.interview.retry_count or 0
    elif ctx.HasField('general'):
        # 일반 컨텍스트는 향후 확장용
        pass
    
    return {
        "interview_id": interview_id,
        "user_id": user_id,
        "stage": stage,
        "retry_count": retry_count,
        "trace_id": ctx.trace_id,
        "audio_format": chunk.audio_format or "pcm16",
        "sample_rate": chunk.sample_rate or SAMPLE_RATE,
        "input_gain": chunk.input_gain or 1.0,
        "client_threshold_percent": chunk.threshold or 5.0,
        "mode": ctx.mode or "practice",
    }

