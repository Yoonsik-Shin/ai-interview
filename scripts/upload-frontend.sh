#!/bin/bash
# 프론트엔드 빌드 및 MinIO 업로드 스크립트

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

echo "📦 프론트엔드 빌드 중..."
cd "$FRONTEND_DIR"
pnpm install
pnpm build

if [ ! -d "dist" ]; then
  echo "❌ 빌드 실패: dist 폴더가 생성되지 않았습니다."
  exit 1
fi

echo "📤 MinIO 업로드 중..."
# MinIO 클라이언트를 사용하여 업로드
# 로컬 환경: kubectl exec로 mc 실행
# 프로덕션: CI/CD에서 mc 클라이언트 직접 사용

if [ -n "$MINIO_ENDPOINT" ] && [ -n "$MINIO_ROOT_USER" ] && [ -n "$MINIO_ROOT_PASSWORD" ]; then
  # 환경 변수가 설정된 경우 직접 업로드
  mc alias set minio "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
  mc mb --ignore-existing minio/frontend
  mc cp --recursive dist/ minio/frontend/
  echo "✅ 업로드 완료"
else
  echo "⚠️  환경 변수가 설정되지 않았습니다."
  echo "   다음 명령을 수동으로 실행하세요:"
  echo "   kubectl run -it --rm mc-upload --image=minio/mc:latest --restart=Never -- \\"
  echo "     sh -c 'mc alias set minio http://minio.unbrdn.svc.cluster.local:9000 \$MINIO_ROOT_USER \$MINIO_ROOT_PASSWORD && \\"
  echo "             mc mb --ignore-existing minio/frontend && \\"
  echo "             mc cp --recursive /path/to/frontend/dist/ minio/frontend/'"
fi
