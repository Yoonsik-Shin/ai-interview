import os
import sys
import threading
from contextlib import asynccontextmanager

# Add generated directory to sys.path to fix gRPC internal import issues
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'generated')))

from fastapi import FastAPI
import uvicorn
from dotenv import load_dotenv

from service.document_service import DocumentService
from service.grpc_server import serve_grpc
from utils.log_format import log_json

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events"""
    global document_service, grpc_server
    log_json("document_service_startup")
    
    try:
        document_service = DocumentService()
        document_service.initialize()

        # Start Kafka consumer in background thread
        worker_thread = threading.Thread(target=document_service.start, daemon=True)
        worker_thread.start()

        # Start gRPC server in background thread
        grpc_port = int(os.getenv("GRPC_PORT", "50053"))
        grpc_server = serve_grpc(grpc_port)
        
        log_json("document_service_ready", grpc_port=grpc_port)
    except Exception as e:
        log_json("document_service_startup_failed", error=str(e))
        raise

    yield  # Application runs here

    # Shutdown logic
    log_json("document_service_shutdown")
    if document_service:
        document_service.stop()
    if grpc_server:
        grpc_server.stop(grace=5)

app = FastAPI(lifespan=lifespan)
document_service = None
grpc_server = None

@app.get("/health")
def health():
    """Liveness probe"""
    return {"status": "ok"}

@app.get("/health/ready")
def health_ready():
    """Readiness probe"""
    return {"status": "ready"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8001")) # Avoid conflict with storage (8000)

    log_json("document_main_start", port=port)

    uvicorn.run(app, host="0.0.0.0", port=port, log_config=None)
