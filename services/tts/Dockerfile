# syntax=docker/dockerfile:1.4
FROM python:3.11-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

RUN useradd -m -u 1000 appuser

ENV PATH="/app/.venv/bin:$PATH"

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen

COPY . .

RUN chown -R appuser:appuser /app

EXPOSE 50053

USER appuser

CMD ["uv", "run", "main.py"]
