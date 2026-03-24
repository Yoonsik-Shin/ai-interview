# syntax=docker/dockerfile:1.4
FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y \
    python3.11 \
    python3.11-venv \
    python3-pip \
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
# This fixes the incompatibility between genderated code (from newer protoc) and runtime (older protobuf)
# Regenerate proto files using the installed (compatible) grpcio-tools
# This fixes the incompatibility between generated code (from newer protoc) and runtime (older protobuf)
# New structure: stt/v1/stt.proto
# Proto 파일 생성 및 패키지 구조 정규화 (하드코딩 replace 제거)
RUN mkdir -p generated \
    && python3.11 -m grpc_tools.protoc -I/app/proto --python_out=generated --grpc_python_out=generated /app/proto/stt/v1/stt.proto \
    && find generated -type d -exec touch {}/__init__.py \;

ENV PYTHONPATH="/app:/app/generated"
RUN chown -R appuser:appuser /app

EXPOSE 50052

USER appuser

CMD ["uv", "run", "main.py"]
