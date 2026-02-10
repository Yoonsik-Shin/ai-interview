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
RUN uv venv && uv pip install -r pyproject.toml

# Copy all application code (.dockerignore로 .venv·캐시 제외)
COPY . .

# Fix ownership
RUN chown -R appuser:appuser /app

# Expose gRPC port
EXPOSE 50051

USER appuser

# Run gRPC server + Redis consumer
CMD ["uv", "run", "main.py"]
