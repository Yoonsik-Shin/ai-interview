# syntax=docker/dockerfile:1.4
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    python3-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

RUN useradd -m -u 1000 appuser

# Sentence-transformers cache
RUN mkdir -p /home/appuser/.cache/huggingface \
    && chown -R appuser:appuser /home/appuser/.cache

ENV HF_HOME=/home/appuser/.cache/huggingface \
    HUGGINGFACE_HUB_CACHE=/home/appuser/.cache/huggingface \
    TRANSFORMERS_CACHE=/home/appuser/.cache/huggingface \
    PATH="/app/.venv/bin:$PATH" \
    PORT=8100

WORKDIR /app

COPY pyproject.toml ./
# If uv.lock exists, uncomment the following line
# COPY uv.lock ./
RUN uv sync

# Copy application code
COPY . .

RUN chown -R appuser:appuser /app

EXPOSE 8100

USER appuser

CMD ["uv", "run", "main.py"]
