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

# Load environment variables
load_dotenv()

app = FastAPI()
storage_service = None


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "storage",
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/health/ready")
async def readiness():
    """Readiness check endpoint"""
    is_ready = storage_service is not None and storage_service.running
    return {
        "status": "ready" if is_ready else "not_ready",
        "service": "storage",
        "timestamp": datetime.now().isoformat(),
    }


@app.on_event("startup")
async def startup():
    """Initialize and start storage service on startup"""
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


@app.on_event("shutdown")
async def shutdown():
    """Gracefully shutdown storage service"""
    global storage_service

    log_json("storage_service_shutdown")

    if storage_service:
        storage_service.stop()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))

    log_json("storage_main_start", port=port)

    uvicorn.run(app, host="0.0.0.0", port=port, log_config=None)
