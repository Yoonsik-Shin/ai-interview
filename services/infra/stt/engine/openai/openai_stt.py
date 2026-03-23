"""
OpenAI Whisper/Realtime engine integration.
"""

import asyncio
import base64
import io
import json
import wave
from typing import Optional

import websockets
from openai import OpenAI

from config import OPENAI_API_KEY, OPENAI_REALTIME_MODEL
from utils.log_format import log_json


def _log(event: str, **fields) -> None:
    log_json(event, service="stt-grpc", **fields)


openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


def pcm16_to_wav_bytes(pcm_data: bytes, sample_rate: int = 16000) -> bytes:
    """Convert PCM16 bytes to WAV bytes (for OpenAI Whisper API)."""
    wav_buffer = io.BytesIO()
    with wave.open(wav_buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_data)
    wav_buffer.seek(0)
    return wav_buffer.read()


def transcribe_with_openai(audio_bytes: bytes, sample_rate: int = 16000) -> str:
    """Transcribe audio with OpenAI Whisper API (non-realtime)."""
    if not openai_client:
        _log("openai_api_not_configured")
        return ""

    wav_data = pcm16_to_wav_bytes(audio_bytes, sample_rate)
    _log("openai_whisper_start", audio_size=len(wav_data))

    audio_file = io.BytesIO(wav_data)
    audio_file.name = "audio.wav"

    response = openai_client.audio.transcriptions.create(
        model="whisper-1", file=audio_file, language="ko", response_format="text"
    )

    result = response.strip() if isinstance(response, str) else str(response).strip()
    _log("openai_whisper_complete", text_length=len(result))

    return result


class OpenAIRealtimeSTT:
    """OpenAI Realtime API client for streaming STT."""

    def __init__(self, api_key: str, model: str = OPENAI_REALTIME_MODEL):
        self.api_key = api_key
        self.model = model
        self.ws_url = "wss://api.openai.com/v1/realtime"
        self.websocket: Optional[websockets.WebSocketClientProtocol] = None
        self.transcript_buffer: list[str] = []
        self.is_connected = False
        self.lock = asyncio.Lock()

    async def connect(self) -> None:
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "OpenAI-Beta": "realtime=v1",
            }

            self.websocket = await websockets.connect(
                f"{self.ws_url}?model={self.model}", extra_headers=headers
            )

            session_config = {
                "type": "session.update",
                "session": {
                    "modalities": ["text", "audio"],
                    "instructions": "Transcribe Korean speech accurately.",
                    "voice": "alloy",
                    "input_audio_format": "pcm16",
                    "output_audio_format": "pcm16",
                    "input_audio_transcription": {"model": "whisper-1"},
                    "turn_detection": {
                        "type": "server_vad",
                        "threshold": 0.5,
                        "prefix_padding_ms": 300,
                        "silence_duration_ms": 500,
                    },
                    "temperature": 0.8,
                },
            }

            await self.websocket.send(json.dumps(session_config))
            self.is_connected = True
            _log("realtime_api_connected", model=self.model)

        except Exception as exc:
            _log("realtime_api_connection_failed", error=str(exc))
            raise

    async def send_audio_chunk(self, audio_data: bytes) -> None:
        if not self.is_connected or not self.websocket:
            raise RuntimeError("WebSocket not connected")

        audio_base64 = base64.b64encode(audio_data).decode("utf-8")
        event = {"type": "input_audio_buffer.append", "audio": audio_base64}
        await self.websocket.send(json.dumps(event))

    async def commit_audio(self) -> None:
        if not self.is_connected or not self.websocket:
            return

        event = {"type": "input_audio_buffer.commit"}
        await self.websocket.send(json.dumps(event))
        _log("realtime_audio_committed")

    async def receive_events(self) -> None:
        try:
            while self.is_connected and self.websocket:
                message = await self.websocket.recv()
                event = json.loads(message)

                event_type = event.get("type")

                if (
                    event_type
                    == "conversation.item.input_audio_transcription.completed"
                ):
                    transcript = event.get("transcript", "")
                    async with self.lock:
                        self.transcript_buffer.append(transcript)
                    _log("realtime_transcript_received", text=transcript)
                elif event_type == "error":
                    _log("realtime_api_error", error=event.get("error", {}))

        except websockets.exceptions.ConnectionClosed:
            _log("realtime_websocket_closed")
            self.is_connected = False
        except Exception as exc:
            _log("realtime_receive_error", error=str(exc))
            self.is_connected = False

    async def get_transcript(self) -> str:
        async with self.lock:
            result = " ".join(self.transcript_buffer).strip()
            self.transcript_buffer.clear()
            return result

    async def close(self) -> None:
        self.is_connected = False
        if self.websocket:
            await self.websocket.close()
            _log("realtime_api_closed")


async def transcribe_with_realtime_api(audio_chunks: list[bytes]) -> str:
    """Transcribe audio chunks with OpenAI Realtime API."""
    if not OPENAI_API_KEY:
        _log("openai_api_key_missing")
        return ""

    try:
        realtime_stt = OpenAIRealtimeSTT(OPENAI_API_KEY)
        await realtime_stt.connect()

        receive_task = asyncio.create_task(realtime_stt.receive_events())

        for chunk in audio_chunks:
            await realtime_stt.send_audio_chunk(chunk)
            await asyncio.sleep(0.01)

        await realtime_stt.commit_audio()
        await asyncio.sleep(2.0)

        transcript = await realtime_stt.get_transcript()

        receive_task.cancel()
        await realtime_stt.close()

        _log("realtime_stt_complete", text_length=len(transcript))
        return transcript

    except Exception as exc:
        _log("realtime_stt_error", error=str(exc))
        return ""
