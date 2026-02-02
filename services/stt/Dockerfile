# syntax=docker/dockerfile:1.4
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

RUN useradd -m -u 1000 appuser

RUN mkdir -p /home/appuser/.cache/huggingface \
    && chown -R appuser:appuser /home/appuser/.cache

ENV HF_HOME=/home/appuser/.cache/huggingface \
    HUGGINGFACE_HUB_CACHE=/home/appuser/.cache/huggingface \
    TRANSFORMERS_CACHE=/home/appuser/.cache/huggingface \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen

# Copy all application code (.dockerignore로 .venv·캐시 제외)
# Copy protoc definitions
COPY --from=proto . /app/proto

# Copy application code
COPY . .

# Regenerate proto files using the installed (compatible) grpcio-tools
# This fixes the incompatibility between generated code (from newer protoc) and runtime (older protobuf)
RUN python -m grpc_tools.protoc -I/app/proto --python_out=. --grpc_python_out=. /app/proto/stt.proto

RUN chown -R appuser:appuser /app

EXPOSE 50052

USER appuser

CMD ["uv", "run", "main.py"]
