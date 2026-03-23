# syntax=docker/dockerfile:1.4
FROM python:3.11-slim

# Install system dependencies (ffmpeg for TTS)
RUN apt-get update && apt-get install -y \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Create app user
RUN useradd -m -u 1000 appuser

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app:/app/generated"

WORKDIR /app

# Install dependencies using uv
COPY pyproject.toml .
RUN uv pip install --system grpcio-tools==1.62.0 \
    && uv pip install --system -r pyproject.toml

# Copy all application code (.dockerignore로 .venv·캐시 제외)
COPY . .

# Proto 파일 복사 (Build Context 활용)
COPY --from=proto . ./proto

# Proto 파일 생성 및 패키지 구조 정규화 (하드코딩 replace 제거)
RUN mkdir -p generated \
    && python -m grpc_tools.protoc -I./proto --python_out=generated --grpc_python_out=generated ./proto/llm/v1/llm.proto \
    && find generated -type d -exec touch {}/__init__.py \;

# Fix ownership
RUN chown -R appuser:appuser /app

# Expose gRPC port
EXPOSE 50051

USER appuser

# Run gRPC server + Redis consumer
CMD ["uv", "run", "main.py"]
