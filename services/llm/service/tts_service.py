"""
TTS (Text-to-Speech) Service - 하이브리드 전략
실전 면접: OpenAI TTS API (감정 표현, 페르소나)
연습 모드: Edge-TTS (무료, MS Azure급 품질)
"""
import os
import io
import json
from datetime import datetime
from typing import Literal
import asyncio
import functools
import edge_tts
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# OpenAI 클라이언트
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def log_json(event: str, **fields):
    """구조화된 JSON 로그 출력"""
    log = {
        "service": "llm-tts",
        "event": event,
        "timestamp": datetime.now().isoformat(),
        **fields
    }
    print(json.dumps(log, ensure_ascii=False), flush=True)


# 페르소나별 목소리 매핑
VOICE_MAP = {
    "PRESSURE": "onyx",      # 낮은 톤, 단호함
    "COMFORTABLE": "nova",   # 밝은 톤, 친근함
    "RANDOM": "alloy",       # 중립적
}


def generate_tts_openai(
    text: str, 
    persona: Literal["PRESSURE", "COMFORTABLE", "RANDOM"] = "COMFORTABLE",
    speed: float = 1.0
) -> bytes:
    """
    OpenAI TTS API로 음성 생성 (실전 면접용)
    
    Args:
        text: 변환할 텍스트
        persona: 면접관 페르소나 (PRESSURE, COMFORTABLE, RANDOM)
        speed: 재생 속도 (0.25 ~ 4.0, 기본 1.0)
    
    Returns:
        MP3 오디오 바이트
    """
    start_time = datetime.now()
    
    try:
        voice = VOICE_MAP.get(persona, "alloy")
        
        log_json("openai_tts_start",
                 textLength=len(text),
                 persona=persona,
                 voice=voice,
                 speed=speed)
        
        response = openai_client.audio.speech.create(
            model="tts-1",
            voice=voice,
            input=text,
            speed=speed,
        )
        
        audio_bytes = response.content
        
        # 비용 계산 (대략)
        chars = len(text)
        cost = chars * (15 / 1_000_000)  # $15 per 1M characters
        
        duration = (datetime.now() - start_time).total_seconds()
        
        log_json("openai_tts_success",
                 textLength=chars,
                 audioSize=len(audio_bytes),
                 generationTime=duration,
                 persona=persona,
                 voice=voice,
                 cost=cost)
        
        return audio_bytes
    
    except Exception as e:
        duration = (datetime.now() - start_time).total_seconds()
        log_json("openai_tts_failed",
                 error=str(e),
                 textLength=len(text),
                 persona=persona,
                 generationTime=duration)
        raise


async def generate_tts_edge(
    text: str,
    voice: str = "ko-KR-SunHiNeural",
    rate: str = "+0%",
    volume: str = "+0%"
) -> bytes:
    """
    Edge-TTS로 음성 생성 (연습 모드용, 무료)
    메모리 스트리밍 방식으로 디스크 I/O 제거
    
    Args:
        text: 변환할 텍스트
        voice: 음성 (기본: 한국어 여성)
        rate: 재생 속도 (-50% ~ +100%)
        volume: 볼륨 (-50% ~ +100%)
    
    Returns:
        MP3 오디오 바이트
    
    Raises:
        Exception: Edge-TTS 접근 실패 시
    """
    start_time = datetime.now()
    
    try:
        log_json("edge_tts_start",
                 textLength=len(text),
                 voice=voice,
                 rate=rate,
                 volume=volume)
        
        communicate = edge_tts.Communicate(
            text=text,
            voice=voice,
            rate=rate,
            volume=volume
        )
        
        # 메모리 버퍼에 오디오 스트리밍
        audio_buffer = io.BytesIO()
        
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_buffer.write(chunk["data"])
        
        audio_buffer.seek(0)
        audio_bytes = audio_buffer.read()
        
        # 빈 오디오 체크
        if len(audio_bytes) == 0:
            raise Exception("Edge-TTS returned empty audio")
        
        duration = (datetime.now() - start_time).total_seconds()
        
        log_json("edge_tts_success",
                 textLength=len(text),
                 audioSize=len(audio_bytes),
                 generationTime=duration,
                 voice=voice,
                 cost=0.0)  # 무료
        
        return audio_bytes
    
    except Exception as e:
        duration = (datetime.now() - start_time).total_seconds()
        log_json("edge_tts_failed",
                 error=str(e),
                 textLength=len(text),
                 voice=voice,
                 generationTime=duration)
        raise


# 필러 워드 목록 (즉각 반응용)
FILLERS_KR = [
    "음, 그렇군요",
    "잠시만요",
    "흠...",
    "이해했습니다",
    "좋습니다",
    "네, 알겠습니다",
]


def get_random_filler() -> str:
    """랜덤 필러 워드 반환"""
    import random
    return random.choice(FILLERS_KR)


# Edge-TTS 음성 목록 (한국어)
EDGE_VOICES_KR = {
    "female_formal": "ko-KR-SunHiNeural",      # 여성, 격식체
    "male_formal": "ko-KR-InJoonNeural",       # 남성, 격식체
    "female_casual": "ko-KR-SoonBokMultilingualNeural",  # 여성, 친근함
}


async def generate_tts(
    text: str,
    persona: Literal["PRESSURE", "COMFORTABLE", "RANDOM"] = "COMFORTABLE",
    speed: float = 1.0,
    prefer: Literal["openai", "edge"] = "openai",
    edge_voice: str = "ko-KR-SunHiNeural",
    edge_rate: str = "+0%",
    edge_volume: str = "+0%",
) -> bytes:
    """
    통합 TTS 엔트리포인트: 우선순위에 따라 OpenAI TTS를 시도하고 실패 시 Edge-TTS로 폴백합니다.

    - `prefer`가 `edge`인 경우 Edge-TTS를 먼저 사용합니다.
    - OpenAI 호출은 블로킹 함수이므로 스레드 풀에서 실행합니다.
    """
    start_time = datetime.now()

    # Helper to call blocking OpenAI TTS in executor
    async def call_openai():
        loop = asyncio.get_event_loop()
        fn = functools.partial(generate_tts_openai, text, persona, speed)
        return await loop.run_in_executor(None, fn)

    # Try preferred provider first
    if prefer == "edge":
        try:
            audio = await generate_tts_edge(text, voice=edge_voice, rate=edge_rate, volume=edge_volume)
            log_json("tts_complete", method="edge", size=len(audio), generationTime=(datetime.now()-start_time).total_seconds())
            return audio
        except Exception as e:
            log_json("tts_edge_failed", error=str(e))
            # fallback to openai
            try:
                audio = await call_openai()
                log_json("tts_complete", method="openai", size=len(audio), generationTime=(datetime.now()-start_time).total_seconds())
                return audio
            except Exception as e2:
                log_json("tts_all_failed", error_openai=str(e2), error_edge=str(e))
                raise

    # prefer openai
    try:
        audio = await call_openai()
        log_json("tts_complete", method="openai", size=len(audio), generationTime=(datetime.now()-start_time).total_seconds())
        return audio
    except Exception as e_open:
        log_json("tts_openai_failed", error=str(e_open))
        # fallback to edge
        try:
            audio = await generate_tts_edge(text, voice=edge_voice, rate=edge_rate, volume=edge_volume)
            log_json("tts_fallback_edge_success", size=len(audio), generationTime=(datetime.now()-start_time).total_seconds())
            return audio
        except Exception as e_edge:
            log_json("tts_all_failed", error_openai=str(e_open), error_edge=str(e_edge))
            raise

