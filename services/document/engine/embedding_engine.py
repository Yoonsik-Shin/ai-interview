from sentence_transformers import SentenceTransformer
import config
from utils.log_format import log_json

class EmbeddingEngine:
    def __init__(self):
        log_json("embedding_engine_loading", model=config.EMBEDDING_MODEL_NAME)
        # Load model (downloads if not cached)
        token = config.HF_TOKEN if config.HF_TOKEN else None
        self.model = SentenceTransformer(config.EMBEDDING_MODEL_NAME, token=token)
        log_json("embedding_engine_loaded")

    def encode(self, text):
        """
        Generates vector embedding for the given text.
        Returns a list of floats.
        """
        try:
            print(f"[EmbeddingEngine] Encoding text preview: \"{text[:50]}...\" (len: {len(text)})")
            # Generate embedding
            # normalize_embeddings=True for cosine similarity
            embedding = self.model.encode(text, normalize_embeddings=True)
            vector = embedding.tolist()
            print(f"[EmbeddingEngine] Generated embedding (dim: {len(vector)}): {vector[:5]} ...")
            return vector
        except Exception as e:
            log_json("embedding_failed", error=str(e))
            raise e
