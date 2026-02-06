#!/usr/bin/env python3
"""
Storage Service - Main Entry Point

Handles Redis → Object Storage upload workflow:
1. Scan Redis queues for audio chunks
2. Assemble chunks into complete files
3. Upload to Object Storage (OCI/S3)
"""

import os
import threading
from datetime import datetime
from dotenv import load_dotenv
from fastapi import FastAPI
import uvicorn

from utils.log_format import log_json
from service.storage_service import StorageService

from contextlib import asynccontextmanager

# Load environment variables
load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events"""
    global storage_service
    log_json("storage_service_startup")
    
    try:
        storage_service = StorageService()
        storage_service.initialize()

        # Start worker in background thread
        worker_thread = threading.Thread(target=storage_service.start, daemon=True)
        worker_thread.start()

        log_json("storage_service_ready")
    except Exception as e:
        log_json("storage_service_startup_failed", error=str(e))
        raise

    yield  # Application runs here

    # Shutdown logic
    log_json("storage_service_shutdown")
    if storage_service:
        storage_service.stop()

app = FastAPI(lifespan=lifespan)
storage_service = None


@app.get("/health")
def health():
    """Liveness probe: process is alive."""
    return {"status": "ok"}


@app.get("/health/ready")
def health_ready():
    """Readiness probe: service and worker are ready to accept traffic."""
    return {"status": "ready"}


from pydantic import BaseModel

class PresignedUrlRequest(BaseModel):
    object_key: str
    method: str = "put_object"  # default to upload for existing clients
    expiration_sec: int = 3600

@app.post("/presigned-url")
def generate_presigned_url(request: PresignedUrlRequest):
    """Generate a presigned URL for upload or download"""
    if not storage_service or not storage_service.storage_engine:
        return {"error": "storage engine not initialized"}, 503
    
    url = storage_service.storage_engine.generate_presigned_url(
        request.object_key, 
        method=request.method,
        expiration=request.expiration_sec
    )
    
    if url:
        return {"url": url}
    return {"error": "failed to generate URL"}, 500



if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))

    log_json("storage_main_start", port=port)

    uvicorn.run(app, host="0.0.0.0", port=port, log_config=None)
