FROM python:3.11-slim

WORKDIR /app

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app:/app/generated"

RUN pip install --no-cache-dir uv

COPY pyproject.toml ./
RUN uv sync

COPY . .

EXPOSE 8000

CMD ["uv", "run", "main.py"]
