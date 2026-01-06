# ------------------------------------
# 1단계: 빌드 (Builder Stage)
# ------------------------------------
FROM python:3.11-slim AS builder

WORKDIR /app

# 시스템 의존성 설치 (빌드에 필요한 패키지)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 의존성 파일 복사
COPY requirements.txt ./

# Python 패키지 설치 (캐시 디렉토리 사용)
RUN pip install --no-cache-dir --user -r requirements.txt

# ------------------------------------
# 2단계: 실행 (Runner Stage) - 최종 이미지
# ------------------------------------
FROM python:3.11-slim AS runner

# 보안을 위한 non-root 사용자 생성
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# 빌드 스테이지에서 설치된 패키지 복사
COPY --from=builder /root/.local /home/appuser/.local

# 소스 코드 복사
COPY --chown=appuser:appuser main.py ./

# PATH에 사용자 로컬 bin 추가
ENV PATH=/home/appuser/.local/bin:$PATH

# non-root 사용자로 전환
USER appuser

# 포트 노출
EXPOSE 8000

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health').read()" || exit 1

# 실행 명령어
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]