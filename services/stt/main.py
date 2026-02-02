"""
STT Service Entry Point
"""
import multiprocessing
import sys
from service.stt_service import serve_grpc

if __name__ == "__main__":
    # uv driven execution
    # Set start method to spawn for safety with libraries using threads/locks, though single process gRPC usually fine.
    # But since we removed multiprocessing wrapper, we are just running one process.
    # However, some libraries (like torch) might prefer specific settings.
    # We will just run serve_grpc directly.
    try:
        serve_grpc()
    except KeyboardInterrupt:
        print("Shutting down STT Service...")
        sys.exit(0)
