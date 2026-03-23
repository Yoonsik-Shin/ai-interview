#!/usr/bin/env python3
"""
Storage Service - Main Entry Point

Handles Redis → Object Storage upload workflow:
1. Scan Redis queues for audio chunks
2. Assemble chunks into complete files
3. Upload to Object Storage (OCI/S3)
4. gRPC server for upload/download URL generation and file deletion
"""

import threading
from dotenv import load_dotenv

from utils.log_format import log_json
from service.storage_service import StorageService
from service.storage_service_grpc import serve_grpc

# Load environment variables
load_dotenv()

if __name__ == "__main__":
    log_json("storage_main_start")
    
    try:
        storage_service = StorageService()
        storage_service.initialize()

        # Start worker in background thread
        worker_thread = threading.Thread(target=storage_service.start, daemon=True)
        worker_thread.start()

        log_json("storage_worker_ready")
        
        # Start gRPC server (blocks until termination)
        serve_grpc(storage_service.storage_engine)
        
    except Exception as e:
        log_json("storage_service_failed", error=str(e))
        raise
