from datetime import datetime
import time
from stt.v1 import stt_pb2
from config import (
    SAMPLE_RATE,
    SERVER_VAD_SILENCE_THRESHOLD,
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


import torch
import numpy as np
from service.worker.vad_engine import VadEngine

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
    stage = "unknown"
    last_chunk_timestamp = None

    # VAD 감지 여부 플래그
    has_vad_speech = False

    # Silero VAD Iterator 초기화 (stage별 동적 임계값 적용 전 임시)
    vad_engine = VadEngine()
    vad_iterator = None  # stage 확인 후 초기화
    
    start_time = time.time()
    MAX_RECORDING_SECONDS = 90  # 하드 타임아웃 (90초)

    for chunk in request_iterator:
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
            mode = meta["mode"]
            stage = meta.get("stage", "unknown")
            
            # Stage별 동적 VAD 임계값 적용
            if stage == "SELF_INTRO":
                min_silence_ms = 3000  # 3.0초 (VAD 감지 속도 향상을 위해 5.0 -> 3.0 단축)
            elif stage == "CANDIDATE_GREETING":
                min_silence_ms = 600   # 0.6초 (인사 단계는 매우 빠르게 전환)
            else:
                min_silence_ms = 1200   # 1.2초 (일반 Q&A 턴 종료)
            
            vad_iterator = vad_engine.get_iterator_with_silence(min_silence_ms)

        if not chunk.audio_data:
            log_json("stt_empty_chunk_ignored", interview_id=interview_id)
            continue
        
        # [FIX] 오디오 데이터를 누적하는 로직 추가 (누락되어 있었음)
        audio_chunks.append(chunk.audio_data)

        # 마지막 청크의 타임스탬프 갱신
        if chunk.timestamp:
            last_chunk_timestamp = chunk.timestamp

        # Silero VAD Processing (vad_iterator가 초기화된 후에만 실행)
        if vad_iterator is not None and audio_format == "pcm16":
            # PCM16 bytes -> Float32 Tensor 변환
            # 방어 코드: 데이터 길이가 2의 배수가 아니면 np.frombuffer에서 ValueError 발생 가능
            if len(chunk.audio_data) % 2 != 0:
                log_json("stt_audio_unaligned", interview_id=interview_id, length=len(chunk.audio_data))
                continue
                
            audio_int16 = np.frombuffer(chunk.audio_data, dtype=np.int16)
            audio_float32 = torch.from_numpy(audio_int16.astype(np.float32) / 32768.0)
            
            # Silero VAD requires chunks of 512 samples for 16kHz
            VAD_CHUNK_SIZE = 512
            num_samples = len(audio_float32)
            
            for i in range(0, num_samples, VAD_CHUNK_SIZE):
                sub_chunk = audio_float32[i:i + VAD_CHUNK_SIZE]
                
                # Check if padding is needed for the last chunk
                if len(sub_chunk) < VAD_CHUNK_SIZE:
                    padding = torch.zeros(VAD_CHUNK_SIZE - len(sub_chunk))
                    sub_chunk = torch.cat([sub_chunk, padding])
                
                # VAD 판별 (return_seconds=True이면 초 단위 타임스탬프 반환)
                speech_dict = vad_iterator(sub_chunk, return_seconds=True)
                
                if speech_dict:
                    if 'start' in speech_dict:
                        log_json("stt_vad_speech_start", interview_id=interview_id, timestamp=speech_dict['start'])
                        has_vad_speech = True
                        
                        # [NEW] 실시간 VAD 시작 신호를 Redis Pub/Sub으로 즉시 발행 (녹화 시작 트리거)
                        if interview_id:
                            vad_start_payload = {
                                "interviewId": interview_id,
                                "event": "VAD_START",
                                "timestamp": datetime.now().isoformat(),
                            }
                            publisher.publish(vad_start_payload, key=str(interview_id))
                    
                    if 'end' in speech_dict:
                        log_json("stt_vad_speech_end", interview_id=interview_id, timestamp=speech_dict['end'])
                        break
            
            # If loop broke due to speech end, break outer loop too
            if speech_dict and 'end' in speech_dict:
                break

        if chunk.is_final:
            break
            
        # [NEW] 하드 타임아웃 체크
        if (time.time() - start_time) > MAX_RECORDING_SECONDS:
            log_json("stt_hard_timeout_reached", interview_id=interview_id, duration=MAX_RECORDING_SECONDS)
            break

    # 2. 입력 없음 처리 (오디오 청크가 하나도 없거나 VAD가 말을 감지하지 못했을 때)
    if not audio_chunks or not has_vad_speech:
        log_transcription_complete("none (vad_rejected)", interview_id or "", "", None)
        
        # [FIX] VAD 거절 시에도 이벤트를 발행하여 Core 서버가 '답변 수신 대기'에서 벗어날 수 있도록 함
        if interview_id:
            stt_payload = {
                "interviewId": interview_id,
                "text": "",
                "isFinal": True,
                "timestamp": datetime.now().isoformat(),
                "engine": "none",
                "isEmpty": True,
                "traceId": trace_id or "unknown",
                "userId": user_id or "unknown",
                "retryCount": meta.get("retry_count", 0),
                "audioReceivedAt": last_chunk_timestamp,
            }
            publisher.publish(stt_payload, key=str(interview_id))

        return stt_pb2.STTResponse(
            text="",
            interview_id=interview_id or "",
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
            "interviewId": interview_id,
            "text": final_text,
            "isFinal": True,
            "timestamp": datetime.now().isoformat(),
            "engine": engine_name,
            "isEmpty": len(final_text) == 0,
            # Socket 서비스에는 없는 필드지만 Trace용으로 유지
            "traceId": trace_id,
            "userId": user_id,
            "retryCount": meta.get("retry_count", 0),
            "audioReceivedAt": last_chunk_timestamp,
        }
        
        # 5. 결과 발행 (Publisher 위임)
        publisher.publish(stt_payload, key=str(interview_id))

        return stt_pb2.STTResponse(
            text=final_text,
            interview_id=interview_id or "",
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
            interview_id=interview_id or "",
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
