"""
STT 엔진 추상화 및 선택 로직
"""

from abc import ABC, abstractmethod
from config import OPENAI_API_KEY


# STT 엔진 인터페이스(추상 클래스)
class STTEngine(ABC):
    @abstractmethod
    def transcribe(self, audio_chunks, mode, **kwargs):
        """
        오디오 청크를 받아 텍스트로 변환하는 추상 메서드
        하위 클래스에서 반드시 구현해야 함
        """
        pass


# 엔진 선택 로직 (구현체는 각 파일에서 import)
def select_engine(mode):
    from engine.whisper.whisper_engine import WhisperEngine
    from engine.openai.openai_engine import OpenAIEngine

    if mode == "real" and OPENAI_API_KEY:
        return OpenAIEngine()
    return WhisperEngine()
