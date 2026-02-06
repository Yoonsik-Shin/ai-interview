import os
from dotenv import load_dotenv

load_dotenv()

# Service Settings
SERVICE_NAME = "document-service"
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Kafka Settings
KAFKA_BOOTSTRAP_SERVERS = os.getenv("SPRING_KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
KAFKA_DOCUMENT_PROCESS_TOPIC = os.getenv("KAFKA_DOCUMENT_PROCESS_TOPIC", "document.process")
KAFKA_DOCUMENT_PROCESSED_TOPIC = os.getenv("KAFKA_DOCUMENT_PROCESSED_TOPIC", "document.processed")
KAFKA_GROUP_ID = os.getenv("KAFKA_GROUP_ID", "document-service-group")

# Object Storage (OCI/MinIO) Settings
STORAGE_SERVICE_URL = os.getenv("STORAGE_SERVICE_URL", "http://localhost:8000")
OBJECT_STORAGE_BUCKET = os.getenv("OBJECT_STORAGE_BUCKET", "interview-archives")
OBJECT_STORAGE_REGION = os.getenv("OBJECT_STORAGE_REGION", "us-east-1")

# Redis Settings (Pub/Sub for notifications)
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
REDIS_DB = int(os.getenv("REDIS_DB", 0))

# Vector DB Settings (PostgreSQL/pgvector)
VECTOR_DB_URL = os.getenv("VECTOR_DB_URL", "postgresql://admin:password@localhost:5432/interview_db")

# Document Processing Settings
MAX_IMAGE_SIZE = int(os.getenv("MAX_IMAGE_SIZE", 1024)) # Max dimension for extracted images
