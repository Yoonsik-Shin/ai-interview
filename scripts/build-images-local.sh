#!/bin/bash

# 로컬 환경 Docker 이미지 빌드 스크립트
# 사용법: ./scripts/build-images-local.sh [TAG] [services...]
# 예시: ./scripts/build-images-local.sh latest bff socket
# 예시: ./scripts/build-images-local.sh bff socket

set -e

# 프로젝트 루트 디렉토리로 이동
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

# 서비스 목록
ALL_SERVICES=("bff" "core" "llm" "socket" "stt" "tts" "storage" "document")
ALL_SERVICE_PATHS=("services/bff" "services/core" "services/llm" "services/socket" "services/stt" "services/tts" "services/storage" "services/document")

# 기본 설정
TAG="latest"
SELECTED_SERVICES=()

# 서비스 이름 판별
is_service() {
    local candidate="$1"
    for service in "${ALL_SERVICES[@]}"; do
        if [ "$service" == "$candidate" ]; then
            return 0
        fi
    done
    return 1
}

# 인자 파싱: 첫 번째가 서비스명이면 TAG는 latest로 유지
NO_CACHE=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        *)
            if is_service "$1"; then
                SELECTED_SERVICES+=("$1")
            else
                # 이미 서비스 목록이 있으면 나머지도 서비스로 간주
                if [ ${#SELECTED_SERVICES[@]} -gt 0 ]; then
                     SELECTED_SERVICES+=("$1")
                else
                    # 첫 번째 non-flag 인자이고 서비스가 아니면 TAG로 간주
                    # 단, 기존 로직 유지 (TAG가 서비스명과 겹치지 않는다고 가정)
                    TAG="$1"
                fi
            fi
            shift
            ;;
    esac
done

# 호스트 아키텍처 자동 감지 (M1/M2 Mac 최적화)
ARCH=$(uname -m)
case "$ARCH" in
    x86_64)
        PLATFORM="linux/amd64"
        ;;
    arm64|aarch64)
        PLATFORM="linux/arm64"
        ;;
    *)
        echo "⚠️  알 수 없는 아키텍처: $ARCH (기본값: linux/amd64 사용)"
        PLATFORM="linux/amd64"
        ;;
esac

echo "🏠 로컬 환경 이미지 빌드를 시작합니다..."
echo "🏷️  태그: ${TAG}"
echo "🖥️  호스트 아키텍처: ${ARCH}"
echo "🏗️  플랫폼: ${PLATFORM}"
echo "⚡ BuildKit 캐시 마운트 활성화 (의존성 캐싱)"
echo ""

# 빌드 전 검증
echo "🔍 빌드 환경 검증 중..."

# Docker 설치 확인
if ! command -v docker &> /dev/null; then
    echo "❌ Docker가 설치되어 있지 않습니다."
    echo "   설치 가이드: https://docs.docker.com/get-docker/"
    exit 1
fi

# Docker 데몬 실행 확인
if ! docker info &> /dev/null; then
    echo "❌ Docker 데몬이 실행되고 있지 않습니다."
    echo "   Docker Desktop을 실행하거나 Docker 서비스를 시작하세요."
    exit 1
fi

# BuildKit 지원 확인
if [ -z "$(docker buildx version 2>/dev/null)" ]; then
    echo "❌ Docker Buildx가 설치되어 있지 않습니다."
    echo "   Docker Desktop 또는 최신 Docker Engine을 사용하세요."
    exit 1
fi

echo "✅ Docker 환경 검증 완료"
echo ""

# Docker BuildKit 활성화 확인
export DOCKER_BUILDKIT=1

# Docker context를 default로 설정 (필요한 경우)
CURRENT_CONTEXT=$(docker context show 2>/dev/null || echo "")
if [ "$CURRENT_CONTEXT" != "default" ]; then
    echo "🔄 Docker context를 default로 전환 중..."
    if docker context use default &>/dev/null; then
        echo "✅ Docker context 전환 완료: default"
    else
        echo "⚠️  Docker context 전환 실패 (계속 진행)"
    fi
    echo ""
fi

# 로컬 빌드에서는 default 빌더 사용 (docker-container 드라이버 문제 회피)
# multiarch-builder는 --load가 제대로 작동하지 않음
if docker buildx inspect default &> /dev/null; then
    docker buildx use default
    echo "✅ default 빌더로 전환 (로컬 이미지 로드 최적화)"
    echo ""
else
    echo "⚠️  default 빌더를 찾을 수 없습니다. 새로 생성합니다..."
    docker buildx create --name default --use --driver docker-container 2>/dev/null || \
    docker buildx create --name default --use --driver docker 2>/dev/null || true
    echo ""
fi

# 선택 서비스 필터링
SERVICES=("${ALL_SERVICES[@]}")
SERVICE_PATHS=("${ALL_SERVICE_PATHS[@]}")

if [ ${#SELECTED_SERVICES[@]} -gt 0 ]; then
    SERVICES=()
    SERVICE_PATHS=()
    for selected in "${SELECTED_SERVICES[@]}"; do
        if ! is_service "$selected"; then
            echo "❌ 알 수 없는 서비스: ${selected}"
            echo "   지원 서비스: ${ALL_SERVICES[*]}"
            exit 1
        fi
        for i in "${!ALL_SERVICES[@]}"; do
            if [ "${ALL_SERVICES[$i]}" == "$selected" ]; then
                SERVICES+=("${ALL_SERVICES[$i]}")
                SERVICE_PATHS+=("${ALL_SERVICE_PATHS[$i]}")
            fi
        done
    done
    echo "🎯 선택 서비스: ${SERVICES[*]}"
    echo ""
fi

# 서비스 디렉토리 존재 확인
echo "📂 서비스 디렉토리 검증 중..."
for i in "${!SERVICES[@]}"; do
    SERVICE_PATH=${SERVICE_PATHS[$i]}
    if [ ! -d "$SERVICE_PATH" ]; then
        echo "❌ 서비스 디렉토리를 찾을 수 없습니다: ${SERVICE_PATH}"
        exit 1
    fi
    if [ ! -f "${SERVICE_PATH}/Dockerfile" ]; then
        echo "❌ Dockerfile을 찾을 수 없습니다: ${SERVICE_PATH}/Dockerfile"
        exit 1
    fi
done
echo "✅ 모든 서비스 디렉토리 확인 완료"
echo ""

# 빌드 시작 시간 기록
BUILD_START=$(date +%s)

# 병렬 빌드를 위한 배열 (Bash 3.2 호환)
BUILD_PIDS=()
BUILD_SERVICES=()
FAILED_SERVICES=()

# 이전 로그 파일 정리
echo "🧹 이전 빌드 로그 정리 중..."
rm -f /tmp/build-*.log
echo ""

# 빌드 상태 추적 파일
BUILD_STATUS_DIR="/tmp/build-status-$$"
mkdir -p "${BUILD_STATUS_DIR}"

# 빌드 기록 파일 (예상 시간 계산용)
BUILD_HISTORY_FILE="$HOME/.build-times-local"

# 예상 시간 조회 함수 (Bash 3.2 호환)
get_estimated_time() {
    local service="$1"
    if [ -f "$BUILD_HISTORY_FILE" ]; then
        grep "^${service}=" "$BUILD_HISTORY_FILE" 2>/dev/null | cut -d'=' -f2
    fi
}

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# TTY 여부 (단일 라인 갱신은 TTY에서만)
USE_SINGLE_LINE=false
[ -t 1 ] && USE_SINGLE_LINE=true

# 빌드 상태 표시: TTY면 단일 라인 \r 덮어쓰기(쌓이지 않음), 완료 시 전체 요약
show_build_status() {
    local total=${#SERVICES[@]}
    local completed=0
    local failed=0
    local max_elapsed=0

    for SERVICE in "${SERVICES[@]}"; do
        local status_file="${BUILD_STATUS_DIR}/${SERVICE}.status"
        local time_file="${BUILD_STATUS_DIR}/${SERVICE}.time"
        if [ -f "$status_file" ]; then
            local result=$(cat "$status_file")
            if [ "$result" == "success" ]; then ((completed++)); elif [ "$result" == "failed" ]; then ((failed++)); fi
        fi
        if [ -f "$time_file" ]; then
            local e=$(cat "$time_file" 2>/dev/null)
            [ -n "$e" ] && [ "$e" -gt "${max_elapsed:-0}" ] 2>/dev/null && max_elapsed=$e
        fi
    done

    if [ "$USE_SINGLE_LINE" != "true" ]; then
        return
    fi

    if [ $completed -eq $total ]; then
        printf '\n'
        echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BOLD}🚀 빌드 진행 상황${NC}"
        echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        for SERVICE in "${SERVICES[@]}"; do
            local status_file="${BUILD_STATUS_DIR}/${SERVICE}.status"
            local time_file="${BUILD_STATUS_DIR}/${SERVICE}.time"
            local status="⏳ 빌드 중..."
            local color="${YELLOW}"
            local elapsed=""
            if [ -f "$status_file" ]; then
                local result=$(cat "$status_file")
                if [ "$result" == "success" ]; then status="완료      "; color="${GREEN}"; [ -f "$time_file" ] && elapsed="($(cat $time_file)초)"; elif [ "$result" == "failed" ]; then status="실패      "; color="${RED}"; [ -f "$time_file" ] && elapsed="($(cat $time_file)초)"; fi
            elif [ -f "$time_file" ]; then elapsed="($(cat $time_file)초)"; fi
            local svc=$(printf "%-12s" "$SERVICE")
            echo -e "  ${color}${svc}${NC} ${status} ${elapsed}"
        done
        echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "  ${GREEN}${BOLD}✨ 모든 빌드가 완료되었습니다!${NC}"
        echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        return
    fi

    local parts=""
    for SERVICE in "${SERVICES[@]}"; do
        local status_file="${BUILD_STATUS_DIR}/${SERVICE}.status"
        local s="⏳"
        if [ -f "$status_file" ]; then
            local r=$(cat "$status_file")
            [ "$r" == "success" ] && s="✅"
            [ "$r" == "failed" ] && s="❌"
        fi
        parts="${parts} ${s} ${SERVICE}"
    done
    printf '\r\033[2K ⏳ Building... %d/%d done |%s | %ds\r' "$completed" "$total" "$parts" "$max_elapsed"
}

# 백그라운드 상태 모니터링
monitor_build_status() {
    local max_iterations=600  # 최대 10분 (600초)
    local iterations=0
    
    while true; do
        # 무한 루프 방지
        ((iterations++))
        if [ $iterations -gt $max_iterations ]; then
            echo ""
            echo "⚠️  빌드 타임아웃 (10분 초과). 진행 중인 빌드를 확인하세요."
            break
        fi
        
        # 모든 빌드 프로세스가 종료되었는지 확인
        local all_done=true
        local running_count=0
        for pid in "${BUILD_PIDS[@]}"; do
            if kill -0 $pid 2>/dev/null; then
                all_done=false
                ((running_count++))
            fi
        done
        
        # 경과 시간 업데이트
        for SERVICE in "${SERVICES[@]}"; do
            local start_file="${BUILD_STATUS_DIR}/${SERVICE}.start"
            local time_file="${BUILD_STATUS_DIR}/${SERVICE}.time"
            local status_file="${BUILD_STATUS_DIR}/${SERVICE}.status"
            
            if [ -f "$start_file" ] && [ ! -f "$status_file" ]; then
                local start_time=$(cat "$start_file")
                local current_time=$(date +%s)
                local elapsed=$((current_time - start_time))
                echo "$elapsed" > "$time_file"
            fi
        done
        
        show_build_status
        
        # 모든 빌드가 완료되었으면 종료
        if $all_done; then
            break
        fi
        
        sleep 1
    done
}

# 각 서비스 병렬 빌드
echo ""
echo -e "${BOLD}🚀 병렬 빌드 시작 (모든 서비스 동시 빌드)...${NC}"

# 예상 시간 표시
HAS_HISTORY=false
if [ -f "$BUILD_HISTORY_FILE" ]; then
    echo -e "${BLUE}📊 이전 빌드 기록 기반 예상 시간:${NC}"
    for SERVICE in "${SERVICES[@]}"; do
        ESTIMATED=$(get_estimated_time "$SERVICE")
        if [ -n "$ESTIMATED" ]; then
            echo "   - ${SERVICE}: 약 ${ESTIMATED}초"
            HAS_HISTORY=true
        fi
    done
fi

if [ "$HAS_HISTORY" = false ]; then
    echo -e "${YELLOW}📊 첫 빌드입니다. 다음 빌드부터 예상 시간이 표시됩니다.${NC}"
fi
echo ""

# 초기 상태 표시
show_build_status

for i in "${!SERVICES[@]}"; do
    SERVICE=${SERVICES[$i]}
    SERVICE_PATH=${SERVICE_PATHS[$i]}
    IMAGE_NAME="${SERVICE}:${TAG}"
    
    # Core 서비스의 경우 빌드 프로파일 설정
    BUILD_ARGS=""
    if [ "$SERVICE" == "core" ]; then
        BUILD_ARGS="--build-arg BUILD_PROFILE=local"
    fi
    
    # 백그라운드로 빌드 실행
    (
        # 시작 시간 기록
        echo "$(date +%s)" > "${BUILD_STATUS_DIR}/${SERVICE}.start"
        
        # 캐시 옵션 설정
        CACHE_FLAGS=""
        if [ "$NO_CACHE" = true ]; then
            CACHE_FLAGS="--no-cache"
        fi

        # Docker 빌드 실행
        docker buildx build \
            --platform ${PLATFORM} \
            --tag ${IMAGE_NAME} \
            ${BUILD_ARGS} \
            ${CACHE_FLAGS} \
            --build-context proto=services/proto \
            --load \
            ${SERVICE_PATH} > /tmp/build-${SERVICE}.log 2>&1
        
        BUILD_EXIT_CODE=$?
        END_TIME=$(date +%s)
        START_TIME=$(cat "${BUILD_STATUS_DIR}/${SERVICE}.start")
        DURATION=$((END_TIME - START_TIME))
        
        echo "$DURATION" > "${BUILD_STATUS_DIR}/${SERVICE}.time"
        
        if [ $BUILD_EXIT_CODE -eq 0 ]; then
            echo "success" > "${BUILD_STATUS_DIR}/${SERVICE}.status"
        else
            echo "failed" > "${BUILD_STATUS_DIR}/${SERVICE}.status"
            echo "Build failed with exit code: $BUILD_EXIT_CODE" >> /tmp/build-${SERVICE}.log
        fi
        
        # Subshell이 실제 빌드 결과를 반환하도록 exit
        exit $BUILD_EXIT_CODE
    ) &
    
    PID=$!
    BUILD_PIDS+=($PID)
    BUILD_SERVICES+=("$SERVICE")
done

# 백그라운드에서 상태 모니터링 시작
monitor_build_status

# 상태 표시 완료 후 커서를 마지막 라인 다음으로 이동
echo ""

# 모든 빌드 프로세스 완료 대기 및 실패 추적
echo "⏳ 빌드 프로세스 완료 대기 중..."
for i in "${!BUILD_PIDS[@]}"; do
    pid=${BUILD_PIDS[$i]}
    service=${BUILD_SERVICES[$i]}
    
    # wait가 실패해도 계속 진행
    if wait $pid 2>/dev/null; then
        EXIT_CODE=0
    else
        EXIT_CODE=$?
    fi
    
    # 상태 파일을 항상 확인 (wait 결과와 무관)
    STATUS_FILE="${BUILD_STATUS_DIR}/${service}.status"
    if [ -f "$STATUS_FILE" ]; then
        STATUS_RESULT=$(cat "$STATUS_FILE")
        if [ "$STATUS_RESULT" == "success" ] && [ $EXIT_CODE -eq 0 ]; then
            echo "✅ ${service} 빌드 프로세스 완료"
        else
            echo "❌ ${service} 빌드 실패 (exit code: ${EXIT_CODE})"
            FAILED_SERVICES+=("$service")
        fi
    else
        # 상태 파일이 없으면 프로세스 문제
        echo "⚠️  ${service} 상태 파일 없음 (exit code: ${EXIT_CODE})"
        FAILED_SERVICES+=("$service")
    fi
done

# 빌드 시간 계산
BUILD_END=$(date +%s)
BUILD_DURATION=$((BUILD_END - BUILD_START))

# 빌드 기록 저장 (예상 시간 계산용)
echo "# 빌드 시간 기록 (자동 생성 - 수정하지 마세요)" > "$BUILD_HISTORY_FILE"
echo "# 형식: service=seconds" >> "$BUILD_HISTORY_FILE"
for SERVICE in "${SERVICES[@]}"; do
    TIME_FILE="${BUILD_STATUS_DIR}/${SERVICE}.time"
    STATUS_FILE="${BUILD_STATUS_DIR}/${SERVICE}.status"
    
    # 성공한 빌드만 기록
    if [ -f "$STATUS_FILE" ] && [ "$(cat $STATUS_FILE)" == "success" ] && [ -f "$TIME_FILE" ]; then
        BUILD_TIME=$(cat "$TIME_FILE")
        echo "${SERVICE}=${BUILD_TIME}" >> "$BUILD_HISTORY_FILE"
    fi
done

# 상태 디렉토리 정리
rm -rf "${BUILD_STATUS_DIR}"

echo ""

if [ ${#FAILED_SERVICES[@]} -gt 0 ]; then
    echo "❌ 빌드 실패: ${#FAILED_SERVICES[@]}개 서비스"
    echo ""
    echo "실패한 서비스:"
    for SERVICE in "${FAILED_SERVICES[@]}"; do
        echo "   - ${SERVICE}"
    done
    echo ""
    echo "📝 상세 로그:"
    for SERVICE in "${FAILED_SERVICES[@]}"; do
        echo ""
        echo "=== ${SERVICE} 빌드 로그 (마지막 20줄) ==="
        tail -n 20 /tmp/build-${SERVICE}.log
        echo ""
        echo "   전체 로그: /tmp/build-${SERVICE}.log"
    done
    echo ""
    echo "💡 문제 해결 방법:"
    echo "   1. 로그에서 에러 메시지 확인"
    echo "   2. Dockerfile 검증: cat services/${FAILED_SERVICES[0]}/Dockerfile"
    echo "   3. 의존성 확인: package.json 또는 build.gradle"
    echo "   4. Docker 캐시 초기화: docker builder prune -a"
    exit 1
fi

echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}🎉 모든 이미지 빌드가 완료되었습니다!${NC}"
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BOLD}⏱️  총 빌드 시간: ${BUILD_DURATION}초${NC}"
echo -e "${BLUE}📊 빌드 시간이 기록되었습니다 (다음 빌드부터 예상 시간 표시)${NC}"
echo ""
echo -e "${BOLD}💾 빌드된 이미지 목록:${NC}"
for SERVICE in "${SERVICES[@]}"; do
    if docker image inspect ${SERVICE}:${TAG} &> /dev/null; then
        SIZE=$(docker images ${SERVICE}:${TAG} --format "{{.Size}}")
        echo -e "   ${GREEN}✓${NC} ${BOLD}${SERVICE}:${TAG}${NC} (${SIZE})"
    else
        echo -e "   ${RED}✗${NC} ${SERVICE}:${TAG} (이미지 조회 실패)"
    fi
done
echo ""
echo "📝 빌드 로그는 /tmp/build-*.log 에서 확인 가능합니다."
echo ""

# Kind 클러스터가 활성 컨텍스트면 자동 이미지 로드 제안
CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "")
if [[ "$CURRENT_CONTEXT" == "kind-unbrdn-local" ]]; then
    echo -e "${BLUE}📦 Kind(unbrdn-local) 컨텍스트 감지: 이미지 로드를 진행합니다.${NC}"
    FAILED_IMAGES=()
    for SERVICE in "${SERVICES[@]}"; do
        IMAGE_NAME="${SERVICE}:${TAG}"
        echo -n "   📦 ${SERVICE}:${TAG} ... "
        if kind load docker-image "$IMAGE_NAME" --name unbrdn-local > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${RED}✗${NC}"
            FAILED_IMAGES+=("$IMAGE_NAME")
        fi
    done
    if [ ${#FAILED_IMAGES[@]} -gt 0 ]; then
        echo -e "${YELLOW}⚠️  일부 이미지 로드 실패: ${FAILED_IMAGES[*]}${NC}"
    else
        echo -e "${GREEN}✅ 모든 이미지 로드 완료${NC}"
    fi
    echo ""
fi

# 인터랙티브 메뉴
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}💡 다음 동작을 선택하세요 (30초 후 자동 종료):${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  0. 종료"
echo "  1. 이미지 확인 (docker images)"
echo "  2. 로컬 배포 (./scripts/deploy-local.sh)"
echo ""
echo -n "선택 (0-2) [엔터]: "

# 30초 타임아웃으로 사용자 입력 대기 (엔터 필요)
if read -t 30 choice; then
    echo ""
    
    case $choice in
        0)
            echo -e "${GREEN}✅ 종료합니다.${NC}"
            ;;
        1)
            echo ""
            echo -e "${BLUE}🔍 빌드된 이미지 목록을 확인합니다.${NC}"
            echo ""
            docker images | head -n 1
            docker images | grep -E "bff|core|llm|socket" | grep "${TAG}"
            echo ""
            ;;
        2)
            echo ""
            echo -e "${BLUE}🚀 로컬 배포를 시작합니다.${NC}"
            echo -e "${YELLOW}⚠️  이 작업은 Kubernetes 클러스터에 리소스를 배포합니다.${NC}"
            echo ""
            
            # 선택된 서비스가 있으면 표시
            if [ ${#SELECTED_SERVICES[@]} -gt 0 ]; then
                echo -e "${CYAN}🎯 다음 서비스만 배포됩니다: ${SELECTED_SERVICES[*]}${NC}"
            else
                echo -e "${CYAN}📦 모든 서비스를 배포합니다.${NC}"
            fi
            echo ""
            
            read -p "정말 배포하시겠습니까? (y/n): " confirm
            if [[ "$confirm" =~ ^[Yy]$ ]]; then
                echo ""
                if [ -f "${PROJECT_ROOT}/scripts/deploy-local.sh" ]; then
                    # 선택된 서비스를 인자로 전달
                    if [ ${#SELECTED_SERVICES[@]} -gt 0 ]; then
                        exec "${PROJECT_ROOT}/scripts/deploy-local.sh" "${SELECTED_SERVICES[@]}"
                    else
                        exec "${PROJECT_ROOT}/scripts/deploy-local.sh"
                    fi
                else
                    echo -e "${RED}❌ deploy-local.sh 파일을 찾을 수 없습니다.${NC}"
                    exit 1
                fi
            else
                echo -e "${YELLOW}배포가 취소되었습니다.${NC}"
            fi
            ;;
        "")
            # 엔터만 눌렀을 때 (빈 입력) - 종료
            echo -e "${GREEN}✅ 종료합니다.${NC}"
            ;;
        *)
            echo -e "${YELLOW}⚠️  잘못된 선택입니다. 종료합니다.${NC}"
            ;;
    esac
else
    # 타임아웃 발생
    echo ""
    echo ""
    echo -e "${YELLOW}⏱️  시간 초과로 자동 종료합니다.${NC}"
fi

echo ""
