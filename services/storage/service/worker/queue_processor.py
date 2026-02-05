import struct
import json
import base64
import redis
from typing import List
from utils.log_format import log_json
from engine.object_storage import ObjectStorageEngine
from service.worker.metadata_utils import extract_metadata

def add_wav_header(pcm_data: bytes, sample_rate: int = 16000, channels: int = 1) -> bytes:
    header = struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF',
        36 + len(pcm_data),
        b'WAVE',
        b'fmt ',
        16,  # PCM format size
        1,   # AudioFormat (1=PCM)
        channels,
        sample_rate,
        sample_rate * channels * 2,  # ByteRate
        channels * 2,                # BlockAlign
        16,                          # BitsPerSample
        b'data',
        len(pcm_data)
    )
    return header + pcm_data

def process_audio_queue(
    redis_client: redis.Redis,
    queue_key: str,
    interview_id: str,
    user_id: str,
    storage_engine: ObjectStorageEngine,
    timeout_sec: int = 30,
) -> bool:
    """
    Process audio queue from Redis, assemble chunks, and upload to object storage

    Args:
        redis_client: Redis client instance
        queue_key: Redis queue key (e.g., interview:audio:queue:123)
        interview_id: Interview ID
        user_id: User ID
        storage_engine: Object storage engine instance
        timeout_sec: BLPOP timeout in seconds

    Returns:
        True if processing succeeded, False otherwise
    """
    log_json("queue_processing_started", queue_key=queue_key, interview_id=interview_id)

    audio_chunks: List[bytes] = []
    metadata = {}

    # BLPOP to sequentially process chunks (blocking, with timeout)
    while True:
        try:
            result = redis_client.blpop(queue_key, timeout=timeout_sec)

            if result is None:
                # Timeout - no more data, finalize processing
                log_json("queue_timeout", queue_key=queue_key)
                break

            _, message_bytes = result
            
            # Treat as uncompressed JSON
            message = json.loads(message_bytes.decode("utf-8"))

            # Update metadata
            if "metadata" in message:
                metadata.update(extract_metadata(message))

            # Append chunk
            if "audioData" in message:
                if isinstance(message["audioData"], str):
                     chunk_data = base64.b64decode(message["audioData"])
                else:
                     # Already binary (if using a different serializer in future, currently usage is JSON so it's string)
                     # But logically wait, JSON loads returns string for base64.
                     chunk_data = base64.b64decode(message["audioData"])
                
                audio_chunks.append(chunk_data)

            # Check for final flag
            if message.get("isFinal", False):
                log_json(
                    "final_chunk_received",
                    queue_key=queue_key,
                    total_chunks=len(audio_chunks),
                )
                break

        except json.JSONDecodeError as e:
            log_json("invalid_json_in_queue", queue_key=queue_key, error=str(e))
            continue
        except Exception as e:
            log_json("queue_read_error", queue_key=queue_key, error=str(e))
            return False

    # Assemble and upload chunks
    if audio_chunks:
        total_audio = b"".join(audio_chunks)
        
        # Add WAV Header if format is PCM
        if metadata.get("format") == "pcm16" or metadata.get("format") is None:
            # Default to 16000Hz, 1 channel if not specified
            sr = int(metadata.get("sample_rate", 16000))
            ch = int(metadata.get("channels", 1))
            total_audio = add_wav_header(total_audio, sample_rate=sr, channels=ch)
            metadata["format"] = "wav"
            log_json("wav_header_added", sample_rate=sr, channels=ch)

        log_json(
            "audio_assembled",
            queue_key=queue_key,
            total_size=len(total_audio),
            chunk_count=len(audio_chunks),
            format=metadata.get("format")
        )

        # Upload to Object Storage
        object_url = storage_engine.upload_file(
            interview_id, user_id, total_audio, metadata
        )

        if object_url:
            log_json(
                "queue_processing_completed",
                queue_key=queue_key,
                object_url=object_url,
            )
            return True
        else:
            log_json("queue_processing_failed_upload", queue_key=queue_key)
            return False
    else:
        log_json("queue_processing_no_data", queue_key=queue_key)
        return False

