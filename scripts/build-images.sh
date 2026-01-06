#!/bin/bash

# Docker Buildx를 사용한 멀티 아키텍처 이미지 빌드 스크립트
# 사용법: ./scripts/build-images.sh [REGISTRY] [TAG] [PLATFORMS]
# 참고: .env 파일에서 환경 변수를 로드합니다. .env.example을 참고하세요.

set -e

# 프로젝트 루트 디렉토리로 이동
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

# .env 파일 로드 (존재하는 경우)
if [ -f .env ]; then
    echo "📝 .env 파일에서 환경 변수를 로드합니다..."
    set -a
    source .env
    set +a
else
    echo "⚠️  .env 파일이 없습니다. .env.example을 복사하여 .env 파일을 생성하세요."
    echo "   cp .env.example .env"
    echo ""
fi

# 환경 변수 또는 파라미터에서 값 가져오기 (파라미터가 우선)
REGISTRY=${1:-${IMAGE_REGISTRY:-""}}
TAG=${2:-${IMAGE_TAG:-"latest"}}
PLATFORMS=${3:-"linux/amd64,linux/arm64"}

echo "🔨 Docker Buildx를 사용한 멀티 아키텍처 이미지 빌드를 시작합니다..."
echo "📦 레지스트리: ${REGISTRY:-'로컬'}"
echo "🏷️  태그: ${TAG}"
echo "🏗️  플랫폼: ${PLATFORMS}"

# Buildx builder 생성 및 활성화
echo "🔧 Buildx builder 설정 중..."
if ! docker buildx ls | grep -q "multiarch-builder"; then
    docker buildx create --name multiarch-builder --use
    docker buildx inspect --bootstrap
else
    docker buildx use multiarch-builder
fi

# 서비스 디렉토리
SERVICES=("bff" "core" "inference" "socket")
SERVICE_PATHS=("services/bff" "services/core" "services/inference" "services/socket")

# Repository 이름 매핑 함수 (환경 변수 또는 기본값 사용)
get_repo_name() {
    case "$1" in
        "bff")
            echo "${REPO_BFF:-unbrdn-krn-ocir-bff}"
            ;;
        "core")
            echo "${REPO_CORE:-unbrdn-krn-ocir-core}"
            ;;
        "inference")
            echo "${REPO_INFERENCE:-unbrdn-krn-ocir-inference}"
            ;;
        "socket")
            echo "${REPO_SOCKET:-unbrdn-krn-ocir-socket}"
            ;;
        *)
            echo "$1"  # 기본값: 서비스 이름 그대로 사용
            ;;
    esac
}

# 이미지 빌드
for i in "${!SERVICES[@]}"; do
    SERVICE=${SERVICES[$i]}
    SERVICE_PATH=${SERVICE_PATHS[$i]}
    REPO_NAME=$(get_repo_name "$SERVICE")
    
    echo ""
    echo "📦 ${SERVICE} 이미지 빌드 중..."
    
    if [ -z "$REGISTRY" ]; then
        # 로컬 빌드
        IMAGE_NAME="${SERVICE}:${TAG}"
        docker buildx build \
            --platform ${PLATFORMS} \
            --tag ${IMAGE_NAME} \
            --load \
            ${SERVICE_PATH}
        echo "✅ ${IMAGE_NAME} 빌드 완료 (로컬)"
    else
        # 레지스트리 푸시 (Repository 이름 사용)
        IMAGE_NAME="${REGISTRY}/${REPO_NAME}:${TAG}"
        docker buildx build \
            --platform ${PLATFORMS} \
            --tag ${IMAGE_NAME} \
            --push \
            ${SERVICE_PATH}
        echo "✅ ${IMAGE_NAME} 빌드 및 푸시 완료"
    fi
done

echo ""
echo "🎉 모든 이미지 빌드가 완료되었습니다!"
echo ""
if [ -n "$REGISTRY" ]; then
    echo "📤 이미지가 다음 레지스트리에 푸시되었습니다:"
    for SERVICE in "${SERVICES[@]}"; do
        REPO_NAME=$(get_repo_name "$SERVICE")
        echo "   - ${REGISTRY}/${REPO_NAME}:${TAG}"
    done
else
    echo "💾 이미지가 로컬에 저장되었습니다:"
    for SERVICE in "${SERVICES[@]}"; do
        echo "   - ${SERVICE}:${TAG}"
    done
fi

