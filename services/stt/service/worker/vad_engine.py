import torch
import logging
from config import (
    SILERO_VAD_THRESHOLD,
    SILERO_VAD_MIN_SILENCE_DURATION_MS,
    SILERO_VAD_SPEECH_PAD_MS,
    SAMPLE_RATE
)

class VadEngine:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(VadEngine, cls).__new__(cls)
            cls._instance._load_model()
        return cls._instance

    def _load_model(self):
        logging.info("Loading Silero VAD model...")
        try:
            # Load model from torch hub
            # trust_repo=True for newer torch versions if needed, avoiding security warning blocking
            self.model, utils = torch.hub.load(repo_or_dir='snakers4/silero-vad',
                                          model='silero_vad',
                                          force_reload=False,
                                          onnx=False)
            
            (self.get_speech_timestamps,
             self.save_audio,
             self.read_audio,
             self.VADIterator,
             self.collect_chunks) = utils
            
            logging.info("Silero VAD model loaded successfully.")
        except Exception as e:
            logging.error(f"Failed to load Silero VAD model: {e}")
            raise e

    def get_iterator(self):
        """
        Create a new VADIterator instance for a stream.
        """
        # VADIterator expects model, threshold, sampling_rate, min_silence_duration_ms, speech_pad_ms
        return self.VADIterator(
            self.model,
            threshold=SILERO_VAD_THRESHOLD,
            sampling_rate=SAMPLE_RATE,
            min_silence_duration_ms=SILERO_VAD_MIN_SILENCE_DURATION_MS,
            speech_pad_ms=SILERO_VAD_SPEECH_PAD_MS
        )
    
    def get_iterator_with_silence(self, min_silence_duration_ms: int):
        """
        Create a new VADIterator instance with custom silence duration.
        Used for stage-specific VAD thresholds (e.g., 1.0s for SELF_INTRO, 0.7s for Q&A).
        """
        return self.VADIterator(
            self.model,
            threshold=SILERO_VAD_THRESHOLD,
            sampling_rate=SAMPLE_RATE,
            min_silence_duration_ms=min_silence_duration_ms,
            speech_pad_ms=SILERO_VAD_SPEECH_PAD_MS
        )
