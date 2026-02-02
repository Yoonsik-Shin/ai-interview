#!/bin/bash

# 프로덕션 환경 Docker 이미지 빌드 및 푸시 스크립트
# 사용법: ./scripts/build-images-prod.sh [REGISTRY] [TAG] [PLATFORMS]
# 예시: ./scripts/build-images-prod.sh icn.ocir.io/axabcdefgh v1.0.0

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
    echo "⚠️  .env 파일이 없습니다. 명령줄 인자를 사용합니다."
fi

# 기본 설정
REGISTRY="${1:-${IMAGE_REGISTRY}}"
TAG="${2:-${IMAGE_TAG:-latest}}"
PLATFORMS="${3:-linux/amd64,linux/arm64}"

# 레지스트리 필수 체크
if [ -z "$REGISTRY" ]; then
    echo "❌ 프로덕션 빌드에는 레지스트리가 필요합니다."
    echo ""
    echo "사용법:"
    echo "  ./scripts/build-images-prod.sh [REGISTRY] [TAG] [PLATFORMS]"
    echo ""
    echo "예시:"
    echo "  ./scripts/build-images-prod.sh icn.ocir.io/axabcdefgh v1.0.0"
    echo "  ./scripts/build-images-prod.sh icn.ocir.io/axabcdefgh latest \"linux/amd64,linux/arm64\""
    exit 1
fi

echo "🚀 프로덕션 환경 이미지 빌드를 시작합니다..."
echo "📦 레지스트리: ${REGISTRY}"
echo "🏷️  태그: ${TAG}"
echo "🏗️  플랫폼: ${PLATFORMS}"
echo "⚡ BuildKit 캐시 마운트 활성화 (의존성 캐싱)"
echo ""

# Docker BuildKit 활성화 확인
export DOCKER_BUILDKIT=1

# Buildx 멀티 아키텍처 빌더 설정
echo "🔧 Buildx 멀티 아키텍처 빌더 설정 중..."
if ! docker buildx ls | grep -q "multiarch-builder"; then
    docker buildx create --name multiarch-builder --use
    docker buildx inspect --bootstrap
else
    docker buildx use multiarch-builder
fi

# 서비스 목록
SERVICES=("bff" "core" "llm" "socket" "stt" "tts" "storage")
SERVICE_PATHS=("services/bff" "services/core" "services/llm" "services/socket" "services/stt" "services/tts" "services/storage")

# Repository 이름 매핑 함수 (환경 변수 또는 기본값 사용)
get_repo_name() {
    case "$1" in
        "bff")
            echo "${REPO_BFF:-unbrdn-krn-ocir-bff}"
            ;;
        "core")
            echo "${REPO_CORE:-unbrdn-krn-ocir-core}"
            ;;
        "llm")
            echo "${REPO_LLM:-unbrdn-krn-ocir-llm}"
            ;;
        "socket")
            echo "${REPO_SOCKET:-unbrdn-krn-ocir-socket}"
            ;;
        "stt")
            echo "${REPO_STT:-unbrdn-krn-ocir-stt}"
            ;;
        "tts")
            echo "${REPO_TTS:-unbrdn-krn-ocir-tts}"
            ;;
        "storage")
            echo "${REPO_STORAGE:-unbrdn-krn-ocir-storage}"
            ;;
        *)
            echo "$1"
            ;;
    esac
}

# 각 서비스 빌드 및 푸시
for i in "${!SERVICES[@]}"; do
    SERVICE=${SERVICES[$i]}
    SERVICE_PATH=${SERVICE_PATHS[$i]}
    REPO_NAME=$(get_repo_name "$SERVICE")
    IMAGE_NAME="${REGISTRY}/${REPO_NAME}:${TAG}"
    
    echo "📦 ${SERVICE} 이미지 빌드 및 푸시 중..."
    echo "   경로: ${SERVICE_PATH}"
    echo "   Repository: ${REPO_NAME}"
    echo "   이미지: ${IMAGE_NAME}"
    
    # Core 서비스의 경우 빌드 프로파일 설정
    BUILD_ARGS=""
    if [ "$SERVICE" == "core" ]; then
        BUILD_ARGS="--build-arg BUILD_PROFILE=prod"
        echo "   빌드 프로파일: prod"
    fi
    
    # Docker buildx를 사용하여 멀티 플랫폼 빌드 및 푸시
    docker buildx build \
        --platform ${PLATFORMS} \
        --tag ${IMAGE_NAME} \
        ${BUILD_ARGS} \
        --build-context proto=services/proto \
        --push \
        ${SERVICE_PATH}
    
    echo "✅ ${IMAGE_NAME} 빌드 및 푸시 완료"
    echo ""
done

echo "🎉 모든 이미지가 빌드되어 레지스트리에 푸시되었습니다!"
echo ""
echo "📤 푸시된 이미지 목록:"
for SERVICE in "${SERVICES[@]}"; do
    REPO_NAME=$(get_repo_name "$SERVICE")
    echo "   - ${REGISTRY}/${REPO_NAME}:${TAG}"
done
echo ""
echo "💡 다음 단계:"
echo "   1. 이미지 확인: 레지스트리에 로그인하여 확인"
echo "   2. 프로덕션 배포: ./scripts/deploy-prod.sh"
echo ""
