import os
from dotenv import load_dotenv

load_dotenv()

# Service Settings
SERVICE_NAME = "document-service"
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Kafka Settings
KAFKA_BOOTSTRAP_SERVERS = os.getenv("SPRING_KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
KAFKA_DOCUMENT_PROCESS_TOPIC = os.getenv("KAFKA_DOCUMENT_PROCESS_TOPIC", "resume.uploaded")
KAFKA_DOCUMENT_PROCESSED_TOPIC = os.getenv("KAFKA_DOCUMENT_PROCESSED_TOPIC", "document.processed")
KAFKA_GROUP_ID = os.getenv("KAFKA_GROUP_ID", "document-service-group")

# Object Storage (OCI/MinIO) Settings
# Object Storage (OCI/MinIO) Settings - Access via Storage Service gRPC
STORAGE_SERVICE_URL = os.getenv("STORAGE_SERVICE_URL", "http://localhost:8000")

# Redis Settings (Pub/Sub for notifications)
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
REDIS_DB = int(os.getenv("REDIS_DB", 0))

# Vector DB Settings (PostgreSQL/pgvector)
VECTOR_DB_URL = os.getenv("VECTOR_DB_URL", "postgresql://admin:password@localhost:5432/interview_db")

# Document Processing Settings
MAX_IMAGE_SIZE = int(os.getenv("MAX_IMAGE_SIZE", 1024)) # Max dimension for extracted images
MIN_IMAGE_WIDTH = int(os.getenv("MIN_IMAGE_WIDTH", 200)) # Ignore small icons
MIN_IMAGE_HEIGHT = int(os.getenv("MIN_IMAGE_HEIGHT", 200))

# Model Settings
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "paraphrase-multilingual-MiniLM-L12-v2")
VLM_MODEL_NAME = os.getenv("VLM_MODEL_NAME", "gpt-4o") # or "claude-3-5-sonnet-20240620"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
HF_TOKEN = os.getenv("HF_TOKEN", "")
