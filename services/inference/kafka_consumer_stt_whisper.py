import os
import json
import base64
import numpy as np
from datetime import datetime
from typing import Dict, Any, List
from dotenv import load_dotenv
from kafka import KafkaConsumer, KafkaProducer
from faster_whisper import WhisperModel
import redis

# .env 파일 로드
load_dotenv()

# 환경 변수 설정
KAFKA_BROKER = os.getenv('KAFKA_BROKER', 'kafka:29092')
INPUT_TOPIC = os.getenv('INPUT_TOPIC', 'interview.audio.input')
OUTPUT_TOPIC = os.getenv('OUTPUT_TOPIC', 'interview.text.input')
REDIS_HOST = os.getenv('REDIS_HOST', 'redis')
REDIS_PORT = int(os.getenv('REDIS_PORT', '6379'))
REDIS_DB = int(os.getenv('REDIS_DB', '1'))

# Faster-Whisper 설정
WHISPER_MODEL_SIZE = os.getenv('WHISPER_MODEL_SIZE', 'tiny')  # tiny, base, small, medium, large
WHISPER_DEVICE = os.getenv('WHISPER_DEVICE', 'cpu')
WHISPER_COMPUTE_TYPE = os.getenv('WHISPER_COMPUTE_TYPE', 'int8')  # int8, float16, float32

SAMPLE_RATE = 16000  # 클라이언트와 동일한 샘플링 레이트

# Redis 클라이언트
redis_client = None

def log_json(event: str, **fields) -> None:
    """
    JSON 포맷으로 표준화된 로그를 출력합니다.
    """
    base = {
        "service": "inference-stt-whisper",
        "event": event,
        "timestamp": datetime.now().isoformat(),
    }
    base.update(fields)
    print(json.dumps(base, ensure_ascii=False), flush=True)

def init_redis():
    global redis_client
    if redis_client is None:
        try:
            redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, socket_connect_timeout=2.0)
            redis_client.ping()
            log_json("redis_connected", host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)
        except redis.exceptions.ConnectionError as e:
            log_json("redis_connection_failed", error=str(e), host=REDIS_HOST, port=REDIS_PORT)
            raise

def preprocess_audio(
    audio_bytes: bytes,
    audio_format: str,
    input_gain: float = 1.0,
    threshold: float = 5.0
) -> np.ndarray:
    """
    오디오 데이터 전처리
    
    Args:
        audio_bytes: 원본 오디오 데이터
        audio_format: 'pcm16' 또는 'webm'
        input_gain: 클라이언트에서 이미 적용됨 (로그용)
        threshold: 클라이언트에서 이미 적용됨 (로그용)
    
    Returns:
        float32 샘플 배열 [-1.0, 1.0]
    """
    # PCM16 처리
    if audio_format == "pcm16":
        samples = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        
        # ⚠️ Gain과 Threshold는 클라이언트에서 이미 적용되어 전송됨
        # 서버에서 다시 적용하면 이중 처리가 됨 (1.4 * 1.4 = 1.96배 증폭!)
        
        # 빈 오디오 체크 (RMS 기반)
        rms = np.sqrt(np.mean(samples ** 2))
        if rms < 0.001:  # 매우 작은 신호는 무음으로 간주
            log_json("audio_too_quiet",
                     rms=float(rms),
                     message="Audio RMS too low, likely silence")
            samples = np.zeros_like(samples)
            return samples
        
        # 피크 정규화 (클리핑 방지)
        peak = np.max(np.abs(samples))
        if peak > 0.9:
            samples = samples * (0.9 / peak)
        
        return samples
    
    else:
        raise ValueError(f"Unsupported audio format: {audio_format}")

# Faster-Whisper 모델 로드 (전역)
whisper_model = None

def init_whisper_model():
    global whisper_model
    if whisper_model is None:
        try:
            log_json("whisper_init_start",
                     modelSize=WHISPER_MODEL_SIZE,
                     device=WHISPER_DEVICE,
                     computeType=WHISPER_COMPUTE_TYPE)
            
            # Faster-Whisper 모델 로드
            # 첫 실행 시 자동으로 모델 다운로드 (Hugging Face)
            whisper_model = WhisperModel(
                WHISPER_MODEL_SIZE,
                device=WHISPER_DEVICE,
                compute_type=WHISPER_COMPUTE_TYPE,
                cpu_threads=4,  # 병렬 처리
                num_workers=1,  # 동시 처리 워커 수
            )
            log_json("whisper_init_success",
                     modelSize=WHISPER_MODEL_SIZE,
                     device=WHISPER_DEVICE)
        except Exception as e:
            log_json("whisper_init_failed", error=str(e))
            raise

# 스트림 상태 관리 (Redis 대신 메모리 사용)
active_streams: Dict[str, List[np.ndarray]] = {}

def process_audio_with_whisper(
    audio_chunks: List[np.ndarray],
    interview_id: str,
    user_id: str
) -> tuple[str, str | None, Dict[str, Any] | None]:
    """
    누적된 오디오 청크를 Faster-Whisper로 처리
    """
    if not audio_chunks:
        log_json("whisper_transcribe_skipped",
                 interviewId=interview_id,
                 userId=user_id,
                 reason="no_audio_chunks")
        return "", "NO_AUDIO_CHUNKS", {"message": "오디오 청크가 없습니다."}

    # 모든 청크를 하나로 합치기
    concatenated_samples = np.concatenate(audio_chunks)
    
    duration_seconds = len(concatenated_samples) / SAMPLE_RATE
    log_json("whisper_transcribe_start",
             interviewId=interview_id,
             userId=user_id,
             chunks=len(audio_chunks),
             totalSamples=len(concatenated_samples),
             durationSeconds=duration_seconds)

    try:
        segments, info = whisper_model.transcribe(
            concatenated_samples,
            language="ko",  # 한국어 명시
            beam_size=5,
            vad_filter=True,  # 음성 활동 감지 필터링
            vad_parameters=dict(min_silence_duration_ms=500)  # 0.5초 이상 침묵 시 분리
        )
        
        final_text = ""
        segments_list = []
        for segment in segments:
            final_text += segment.text
            segments_list.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text
            })

        log_json("whisper_transcribe_complete",
                 interviewId=interview_id,
                 userId=user_id,
                 finalText=final_text,
                 textLength=len(final_text),
                 segments=len(segments_list),
                 processingTime=info.duration,
                 detectedLanguage=info.language,
                 languageProbability=info.language_probability)
        
        return final_text, None, None

    except Exception as e:
        log_json("whisper_transcribe_failed",
                 interviewId=interview_id,
                 userId=user_id,
                 error=str(e))
        return "", "TRANSCRIBE_ERROR", {"message": f"음성 인식 중 오류 발생: {str(e)}"}

def handle_message(message_value: Dict[str, Any], producer: KafkaProducer) -> None:
    """
    Kafka 메시지 처리 (오디오 청크 수신 → STT → 결과 전송)
    """
    interview_id = message_value.get('interviewId')
    user_id = message_value.get('userId')
    audio_chunk_base64 = message_value.get('audioChunk')
    is_final = message_value.get('isFinal', False)
    audio_format = message_value.get('audioFormat', 'pcm16')
    input_gain = message_value.get('inputGain', 1.0)
    threshold = message_value.get('threshold', 5.0)  # 기본값 5%
    
    if not all([interview_id, user_id]):
        log_json("invalid_message", message=message_value)
        return

    # 빈 오디오 청크 처리
    if audio_chunk_base64 is None or len(audio_chunk_base64) == 0:
        log_json("empty_audio_chunk_received",
                 interviewId=interview_id,
                 userId=user_id,
                 isFinal=is_final)
        if not is_final:  # 중간 청크가 비어있으면 무시
            return
        # is_final이 true인데 오디오가 비어있으면 빈 배열로 처리
        audio_bytes = b''
    else:
        try:
            audio_bytes = base64.b64decode(audio_chunk_base64)
        except Exception as e:
            log_json("base64_decode_failed",
                     interviewId=interview_id,
                     userId=user_id,
                     error=str(e))
            return

    try:
        # 오디오 전처리
        if audio_bytes:
            samples = preprocess_audio(audio_bytes, audio_format, input_gain, threshold)
        else:
            samples = np.array([], dtype=np.float32)
        
        # 최종 청크인 경우 - 누적된 모든 오디오 처리
        if is_final:
            # 스트림 초기화 확인
            if interview_id not in active_streams:
                log_json("stream_not_found_on_final",
                         interviewId=interview_id,
                         userId=user_id,
                         message="No active stream found for final chunk. Processing only current chunk.")
                # 현재 청크만으로 처리 시도 (예외 상황)
                chunks_to_process = [samples] if len(samples) > 0 else []
            else:
                # 누적된 모든 청크에 현재 최종 청크 추가
                if len(samples) > 0:
                    active_streams[interview_id].append(samples)
                chunks_to_process = active_streams[interview_id]

            # Whisper STT 실행
            final_text, failure_reason, failure_details = process_audio_with_whisper(
                chunks_to_process, interview_id, user_id
            )
            
            # 결과 전송
            result_message = {
                'interviewId': interview_id,
                'userId': user_id,
                'text': final_text,
                'engine': 'faster-whisper',
                'modelSize': WHISPER_MODEL_SIZE,
                'isEmpty': not bool(final_text),
                'timestamp': datetime.now().isoformat()
            }
            
            if failure_reason:
                result_message['failureReason'] = failure_reason
                result_message['failureDetails'] = failure_details
            
            # key_serializer와 value_serializer가 자동으로 인코딩하므로 문자열과 dict를 직접 전달
            producer.send(
                OUTPUT_TOPIC,
                key=str(interview_id),
                value=result_message
            )
            
            log_json("stream_finalized",
                     interviewId=interview_id,
                     userId=user_id,
                     finalText=final_text,
                     chunksProcessed=len(chunks_to_process))
            
            # 스트림 정리
            if interview_id in active_streams:
                del active_streams[interview_id]
        
        else:
            # 중간 청크 - 버퍼에 누적만
            if len(samples) > 0:
                if interview_id not in active_streams:
                    active_streams[interview_id] = []
                active_streams[interview_id].append(samples)
                log_json("chunk_buffered",
                         interviewId=interview_id,
                         userId=user_id,
                         chunkIndex=len(active_streams[interview_id]),
                         samples=len(samples))

    except Exception as e:
        log_json("message_handling_failed",
                 interviewId=interview_id,
                 userId=user_id,
                 error=str(e),
                 errorType=type(e).__name__)

def main():
    init_redis()
    init_whisper_model()

    consumer = KafkaConsumer(
        INPUT_TOPIC,
        bootstrap_servers=[KAFKA_BROKER],
        value_deserializer=lambda m: json.loads(m.decode('utf-8')),
        group_id='stt-whisper-consumer-group',
        auto_offset_reset='earliest',
        enable_auto_commit=True,  # Faster-Whisper는 최종 결과만 중요하므로 자동 커밋
        max_poll_records=1,  # 한 번에 하나씩 처리하여 지연 최소화
        session_timeout_ms=60000,
        heartbeat_interval_ms=10000,
        max_poll_interval_ms=300000,
        fetch_max_wait_ms=500,  # 메시지 가져올 때 최대 0.5초 대기
        connections_max_idle_ms=600000
    )

    producer = KafkaProducer(
        bootstrap_servers=[KAFKA_BROKER],
        value_serializer=lambda v: json.dumps(v).encode('utf-8'),
        key_serializer=lambda k: k.encode('utf-8')
    )

    log_json("consumer_ready")

    try:
        for message in consumer:
            handle_message(message.value, producer)
    except KeyboardInterrupt:
        log_json("consumer_stopped", reason="KeyboardInterrupt")
    finally:
        consumer.close()
        producer.close()
        log_json("consumer_closed")

if __name__ == "__main__":
    main()
