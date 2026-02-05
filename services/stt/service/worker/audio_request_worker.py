from datetime import datetime
import time
from generated import stt_pb2
from config import (
    SAMPLE_RATE,
    SERVER_VAD_SILENCE_THRESHOLD,
    OUTPUT_TOPIC,
    KAFKA_ENABLED,
    STT_REDIS_CHANNEL,
    STT_REDIS_STREAM,
)
from engine.stt_engine import select_engine
from service.worker.postprocess import postprocess_text
from utils.audio_utils import preprocess_audio, calculate_chunk_rms
from service.worker.metadata_utils import extract_metadata
from service.worker.vad_utils import vad_update
from utils.log_format import log_json
from service.publisher import SttPublisher

# Publisher 인스턴스 (Stateless하므로 전역 또는 모듈 레벨에서 재사용 가능)
publisher = SttPublisher()


def process_audio_request(request_iterator) -> stt_pb2.STTResponse:
    """
    gRPC 요청 스트림을 받아 STT 전체 비즈니스 로직을 처리합니다.
    주요 단계:
      1. 오디오 청크 수집 및 메타데이터 파싱 (interview_id, user_id 등)
      2. VAD(음성 감지)로 음성 구간/침묵 구간 판단 및 자동 종료 조건 체크
      3. 엔진 선택(select_engine) 및 음성 인식 실행 (Whisper/OpenAI 등)
      4. 후처리(postprocess_text) 및 최종 응답 생성
    Args:
        request_iterator: gRPC로부터 전달되는 오디오 청크 스트림
    Returns:
        stt_pb2.STTResponse: 최종 음성 인식 결과 및 메타데이터
    """
    audio_chunks = []  # 오디오 데이터 청크 누적 리스트
    # 메타데이터 초기값 (최초 청크에서 추출)
    interview_id = None
    user_id = None
    trace_id = None
    audio_format = "pcm16"
    sample_rate = SAMPLE_RATE
    input_gain = 1.0
    client_threshold_percent = 5.0
    mode = "practice"
    last_chunk_timestamp = None

    silence_start_time = None  # 침묵 구간 시작 시각
    has_speech = False  # 음성 감지 여부
    total_speech_samples = 0  # 누적 음성 샘플 수
    auto_finalize = False  # 자동 종료 플래그

    # 1. 오디오 청크 수집 및 VAD(음성 감지)
    for chunk in request_iterator:
        audio_chunks.append(chunk.audio_data)
        # 최초 청크에서 interview_id 등 메타데이터 추출
        if interview_id is None:
            meta = extract_metadata(chunk)
            interview_id = meta["interview_id"]
            user_id = meta["user_id"]
            trace_id = meta["trace_id"]
            audio_format = meta["audio_format"]
            sample_rate = meta["sample_rate"]
            input_gain = meta["input_gain"]
            client_threshold_percent = meta["client_threshold_percent"]
            client_threshold_percent = meta["client_threshold_percent"]
            mode = meta["mode"]
        
        # 마지막 청크의 타임스탬프 갱신
        if chunk.timestamp:
            last_chunk_timestamp = chunk.timestamp

        # RMS(루트평균제곱)로 음성 세기 측정
        chunk_rms = calculate_chunk_rms(chunk.audio_data)
        chunk_samples = len(chunk.audio_data) // 2  # 16bit PCM 기준 샘플 수

        # VAD 상태 갱신 및 자동 finalize 판단
        has_speech, total_speech_samples, silence_start_time, auto_finalize = (
            vad_update(
                chunk_rms,
                chunk_samples,
                sample_rate,
                has_speech,
                total_speech_samples,
                silence_start_time,
                time,
            )
        )

        # 자동 finalize 조건(충분한 음성 후 침묵 지속) 시 로그 및 루프 종료
        if auto_finalize:
            silence_duration = (
                time.time() - silence_start_time if silence_start_time else 0
            )
                # log_vad_auto_finalize(
                #     interview_id, silence_duration, total_speech_samples / sample_rate
                # )
            break
        if chunk.is_final:
            break

    # 2. 입력 없음 처리 (오디오 청크가 하나도 없을 때)
    if not audio_chunks:
        return stt_pb2.STTResponse(
            text="",
            interview_id=interview_id or 0,
            user_id=user_id or "",
            is_empty=True,
            engine="none",
            trace_id=trace_id or "",
            timestamp=datetime.now().isoformat(),
        )

    # 3. 엔진 선택 및 음성 인식 실행
    try:
        # mode(practice/real 등)에 따라 엔진(Whisper/OpenAI 등) 선택
        engine = select_engine(mode)
        final_text, info, engine_name = engine.transcribe(
            audio_chunks,
            mode,
            audio_format=audio_format,
            input_gain=input_gain,
            client_threshold_percent=client_threshold_percent,
            preprocess_audio=preprocess_audio,
        )
        # 4. 후처리 및 응답 생성
        final_text = postprocess_text(final_text)
        # 최종 결과만 로그
        log_transcription_complete(engine_name, interview_id, final_text, info)

        # STT 결과 payload (Redis Pub/Sub, Redis Streams, Kafka 공유)
        stt_payload = {
            "interviewSessionId": interview_id,
            "text": final_text,
            "isFinal": True,
            "timestamp": datetime.now().isoformat(),
            "engine": engine_name,
            "isEmpty": len(final_text) == 0,
            # Socket 서비스에는 없는 필드지만 Trace용으로 유지
            "traceId": trace_id,
            "userId": user_id,
            "audioReceivedAt": last_chunk_timestamp,
        }
        
        # 5. 결과 발행 (Publisher 위임)
        publisher.publish(stt_payload, key=str(interview_id))

        return stt_pb2.STTResponse(
            text=final_text,
            interview_id=interview_id or 0,
            user_id=user_id or "",
            is_empty=len(final_text) == 0,
            engine=engine_name,
            trace_id=trace_id or "",
            timestamp=datetime.now().isoformat(),
        )
    except Exception as exc:
        # 엔진 오류 발생 시 에러 로그 및 빈 응답 반환
        log_stt_grpc_error(interview_id, exc)
        return stt_pb2.STTResponse(
            text="",
            interview_id=interview_id or 0,
            user_id=user_id or "",
            is_empty=True,
            engine="error",
            trace_id=trace_id or "",
            timestamp=datetime.now().isoformat(),
        )


def log_vad_auto_finalize(interview_id, silence_duration, total_speech_sec):
    log_json(
        "server_vad_auto_finalize",
        service="stt-grpc",
        interview_id=interview_id,
        silence_duration=silence_duration,
        total_speech_sec=total_speech_sec,
    )


def log_transcription_complete(engine_name, interview_id, final_text, info):
    log_json(
        f"{engine_name}_transcription_complete",
        service="stt-grpc",
        interview_id=interview_id,
        text_length=len(final_text),
        language=getattr(info, "language", None) if info else None,
        language_probability=(
            getattr(info, "language_probability", None) if info else None
        ),
    )


def log_stt_grpc_error(interview_id, exc):
    log_json(
        "stt_grpc_error", service="stt-grpc", interview_id=interview_id, error=str(exc)
    )
