import torch
from sentence_transformers import SentenceTransformer
import config
from utils.log_format import log_json

class EmbeddingEngine:
    def __init__(self):
        log_json("embedding_engine_loading", model=config.EMBEDDING_MODEL_NAME)
        # Determine device (prefer MPS for Mac GPU, fallback to CPU)
        device = 'cpu'
        if torch.backends.mps.is_available():
            device = 'mps'
            log_json("embedding_engine_using_mps", status="enabled")
        
        # Load model (downloads if not cached)
        token = config.HF_TOKEN if config.HF_TOKEN else None
        # Disable progress bar and use optimized device
        self.model = SentenceTransformer(
            config.EMBEDDING_MODEL_NAME, 
            token=token, 
            device=device
        )
        log_json("embedding_engine_loaded")

    def encode(self, text):
        """
        Generates vector embedding for the given text.
        Returns a list of floats.
        """
        try:
            # Generate embedding
            # normalize_embeddings=True for cosine similarity
            embedding = self.model.encode(
                text, 
                normalize_embeddings=True,
                show_progress_bar=False # Disable progress bar during encoding
            )
            vector = embedding.tolist()
            return vector
        except Exception as e:
            log_json("embedding_failed", error=str(e))
            raise e
