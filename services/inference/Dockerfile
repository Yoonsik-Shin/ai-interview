# syntax=docker/dockerfile:1.4
# ------------------------------------
# 1단계: 빌드 (Builder Stage)
# ------------------------------------
FROM python:3.11-slim AS builder

WORKDIR /app

# 시스템 의존성 설치 (빌드에 필요한 패키지)
# ffmpeg: Whisper가 오디오 파일 처리에 사용
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# 의존성 파일 복사 (프로덕션용만)
COPY requirements-prod.txt ./

# Python 패키지 설치 (Supervisor 포함)
# 프로덕션 의존성만 설치하여 이미지 크기 최소화
# BuildKit 캐시 마운트로 pip 캐시 재사용 (속도 향상)
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --user -r requirements-prod.txt supervisor

# Proto 파일 복사 및 컴파일 (builder 스테이지에서)
COPY --from=proto . ./proto
RUN mkdir -p generated \
    && python -m grpc_tools.protoc \
    -I./proto \
    --python_out=generated \
    --grpc_python_out=generated \
    proto/inference.proto \
    && python -c "import sys; content = open('generated/inference_pb2_grpc.py').read(); open('generated/inference_pb2_grpc.py', 'w').write(content.replace('import inference_pb2 as inference__pb2', 'from . import inference_pb2 as inference__pb2'))" \
    && touch generated/__init__.py

# ------------------------------------
# 2단계: 실행 (Runner Stage) - 최종 이미지
# ------------------------------------
FROM python:3.11-slim AS runner

# ffmpeg 런타임 의존성 설치 (Whisper용)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# 보안을 위한 non-root 사용자 생성
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# 빌드 스테이지에서 설치된 패키지 및 컴파일된 proto 파일 복사
COPY --from=builder /root/.local /home/appuser/.local
COPY --from=builder /app/generated ./generated

# 소스 코드 복사
COPY --chown=appuser:appuser main.py ./
COPY --chown=appuser:appuser kafka_consumer_stt_whisper.py ./
COPY --chown=appuser:appuser tts_service.py ./
COPY --chown=appuser:appuser grpc_server.py ./
COPY --chown=appuser:appuser supervisord.conf ./
COPY --chown=appuser:appuser --from=proto . ./proto

# PATH에 사용자 로컬 bin 추가
ENV PATH=/home/appuser/.local/bin:$PATH

# Hugging Face 캐시 디렉토리 (Faster-Whisper용)
ENV HF_HOME=/app/.cache
ENV TRANSFORMERS_CACHE=/app/.cache/transformers

# 모델 캐시 디렉토리 생성 및 권한 설정
RUN mkdir -p /app/.cache && \
    chown -R appuser:appuser /app/.cache

# non-root 사용자로 전환
USER appuser

# 포트 노출
EXPOSE 8000 50051

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health').read()" || exit 1

# 실행 명령어: Supervisor로 FastAPI + Kafka Consumer 동시 실행
CMD ["supervisord", "-c", "supervisord.conf"]
