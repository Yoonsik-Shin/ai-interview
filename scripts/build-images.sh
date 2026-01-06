#!/bin/bash

# Docker Buildx를 사용한 멀티 아키텍처 이미지 빌드 스크립트
# 사용법:
#   로컬 빌드:   ./scripts/build-images.sh --local [TAG] [PLATFORM]
#   프로덕션 빌드: ./scripts/build-images.sh --prod [REGISTRY] [TAG] [PLATFORMS]
#   또는:        ./scripts/build-images.sh [REGISTRY] [TAG] [PLATFORMS] (레지스트리가 있으면 자동으로 프로덕션 모드)
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

# 환경 모드 파싱
BUILD_MODE="local"  # 기본값: 로컬
REGISTRY=""
TAG="latest"
PLATFORMS="linux/amd64"

# 플래그 파싱
if [ "$1" == "--local" ]; then
    BUILD_MODE="local"
    TAG=${2:-${IMAGE_TAG:-"latest"}}
    PLATFORMS=${3:-"linux/amd64"}  # 로컬은 단일 플랫폼만
    echo "🏠 로컬 빌드 모드"
elif [ "$1" == "--prod" ]; then
    BUILD_MODE="prod"
    REGISTRY=${2:-${IMAGE_REGISTRY:-""}}
    TAG=${3:-${IMAGE_TAG:-"latest"}}
    PLATFORMS=${4:-"linux/amd64,linux/arm64"}  # 프로덕션은 멀티 플랫폼
    if [ -z "$REGISTRY" ]; then
        echo "❌ 프로덕션 모드에서는 레지스트리가 필요합니다."
        echo "   사용법: ./scripts/build-images.sh --prod [REGISTRY] [TAG] [PLATFORMS]"
        exit 1
    fi
    echo "🚀 프로덕션 빌드 모드"
else
    # 레거시 호환성: REGISTRY가 제공되면 자동으로 프로덕션 모드
    REGISTRY=${1:-${IMAGE_REGISTRY:-""}}
    TAG=${2:-${IMAGE_TAG:-"latest"}}
    PLATFORMS=${3:-"linux/amd64,linux/arm64"}
    
    if [ -n "$REGISTRY" ]; then
        BUILD_MODE="prod"
        echo "🚀 프로덕션 빌드 모드 (레지스트리 자동 감지)"
    else
        BUILD_MODE="local"
        PLATFORMS="linux/amd64"  # 레지스트리가 없으면 로컬 모드로 단일 플랫폼
        echo "🏠 로컬 빌드 모드 (레지스트리 없음)"
    fi
fi

echo "🔨 Docker 이미지 빌드를 시작합니다..."
echo "📦 모드: ${BUILD_MODE}"
if [ "$BUILD_MODE" == "prod" ]; then
    echo "📦 레지스트리: ${REGISTRY}"
fi
echo "🏷️  태그: ${TAG}"
echo "🏗️  플랫폼: ${PLATFORMS}"

# Buildx builder 설정
if [ "$BUILD_MODE" == "prod" ]; then
    echo "🔧 Buildx 멀티 아키텍처 빌더 설정 중..."
    if ! docker buildx ls | grep -q "multiarch-builder"; then
        docker buildx create --name multiarch-builder --use
        docker buildx inspect --bootstrap
    else
        docker buildx use multiarch-builder
    fi
else
    echo "🔧 로컬 빌드 모드 (기본 빌더 사용)"
    # 로컬 모드에서도 buildx 사용 (--load 옵션으로 로컬에 저장)
    if ! docker buildx ls | grep -q "default"; then
        docker buildx create --name default --use 2>/dev/null || docker buildx use default
    fi
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
    
    # Core 서비스의 경우 빌드 프로파일 설정
    BUILD_ARGS=""
    if [ "$SERVICE" == "core" ]; then
        if [ "$BUILD_MODE" == "local" ]; then
            BUILD_PROFILE="local"
        else
            BUILD_PROFILE="prod"
        fi
        BUILD_ARGS="--build-arg BUILD_PROFILE=${BUILD_PROFILE}"
        echo "   빌드 프로파일: ${BUILD_PROFILE}"
    fi
    
    if [ "$BUILD_MODE" == "local" ]; then
        # 로컬 빌드: 단일 플랫폼, --load 옵션으로 로컬에 저장
        IMAGE_NAME="${SERVICE}:${TAG}"
        echo "   플랫폼: ${PLATFORMS}"
        echo "   이미지: ${IMAGE_NAME}"
        
        docker buildx build \
            --platform ${PLATFORMS} \
            --tag ${IMAGE_NAME} \
            ${BUILD_ARGS} \
            --load \
            ${SERVICE_PATH}
        echo "✅ ${IMAGE_NAME} 빌드 완료 (로컬)"
    else
        # 프로덕션 빌드: 멀티 플랫폼, --push 옵션
        IMAGE_NAME="${REGISTRY}/${REPO_NAME}:${TAG}"
        echo "   플랫폼: ${PLATFORMS}"
        echo "   이미지: ${IMAGE_NAME}"
        
        docker buildx build \
            --platform ${PLATFORMS} \
            --tag ${IMAGE_NAME} \
            ${BUILD_ARGS} \
            --push \
            ${SERVICE_PATH}
        echo "✅ ${IMAGE_NAME} 빌드 및 푸시 완료 (프로덕션)"
    fi
done

echo ""
echo "🎉 모든 이미지 빌드가 완료되었습니다!"
echo ""
if [ "$BUILD_MODE" == "prod" ]; then
    echo "📤 이미지가 다음 레지스트리에 푸시되었습니다:"
    for SERVICE in "${SERVICES[@]}"; do
        REPO_NAME=$(get_repo_name "$SERVICE")
        echo "   - ${REGISTRY}/${REPO_NAME}:${TAG}"
    done
    echo ""
    echo "💡 배포 명령어:"
    echo "   ./scripts/deploy-prod.sh ${REGISTRY} ${TAG}"
else
    echo "💾 이미지가 로컬에 저장되었습니다:"
    for SERVICE in "${SERVICES[@]}"; do
        echo "   - ${SERVICE}:${TAG}"
    done
    echo ""
    echo "💡 배포 명령어:"
    echo "   ./scripts/deploy-local.sh"
fi

