#!/bin/bash

# 로컬 환경 배포 스크립트 (Clean & Tree-style Logs)
# 사용법: ./scripts/deploy-local.sh

set -e

NAMESPACE="unbrdn"
KAFKA_NAMESPACE="kafka"
MONITORING_NAMESPACE="monitoring"

# 서비스 목록 정의 및 인자 처리 (최상단으로 이동)
ALL_APP_SERVICES=("llm" "stt" "tts" "storage" "document" "auth" "interview" "payment" "resume" "bff" "socket")
SELECTED_SERVICES=()

if [ $# -gt 0 ]; then
    for arg in "$@"; do
        FOUND=false
        for svc in "${ALL_APP_SERVICES[@]}"; do
            if [ "$svc" == "$arg" ]; then
                SELECTED_SERVICES+=("$svc")
                FOUND=true
                break
            fi
        done
        if [ "$FOUND" = false ]; then
            echo -e "\033[0;33m⚠️  알 수 없는 서비스: $arg (무시됨)\033[0m"
        fi
    done
fi

# 배포 대상 서비스 확정
if [ ${#SELECTED_SERVICES[@]} -gt 0 ]; then
    SERVICES=("${SELECTED_SERVICES[@]}")
else
    SERVICES=("${ALL_APP_SERVICES[@]}")
fi

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'
DIM='\033[2m'
CLEAR_LINE='\033[2K'

# 로깅 헬퍼 함수
log_section() {
    echo -e "\n${BOLD}🚀 $1${NC}"
}

log_task() {
    echo -e "${CYAN}├──${NC} $1"
}

log_subtask() {
    echo -e "${CYAN}│   ├──${NC} $1"
}

log_info() {
    echo -e "${CYAN}│   │${NC}   $1"
}

log_success() {
    echo -e "${CYAN}│   └──${NC} ${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${CYAN}│   └──${NC} ${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${CYAN}│   └──${NC} ${RED}❌ $1${NC}"
}

# base64 decode
b64dec() {
  base64 -d 2>/dev/null || base64 -D 2>/dev/null
}

# 스피너 애니메이션
SPINNER_FRAMES=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")
SPINNER_PID=""

start_spinner() {
    local message="$1"
    local delay=0.1
    local frame=0
    
    # 커서 숨김
    tput civis 2>/dev/null || true
    
    (
        while true; do
            printf "\r${CLEAR_LINE}${CYAN}│   ├──${NC} ${CYAN}${SPINNER_FRAMES[$frame]}${NC} ${message}"
            frame=$(( (frame + 1) % ${#SPINNER_FRAMES[@]} ))
            sleep $delay
        done
    ) &
    
    SPINNER_PID=$!
    # disown을 사용하여 백그라운드 프로세스 종료 시 셸이 메시지를 출력하지 않도록 함
    disown $SPINNER_PID 2>/dev/null || true
}

stop_spinner() {
    local status="$1"  # success, warning, error
    local message="$2"
    
    if [ -n "$SPINNER_PID" ]; then
        kill $SPINNER_PID 2>/dev/null || true
        wait $SPINNER_PID 2>/dev/null || true
        SPINNER_PID=""
    fi
    
    # 커서 복구
    tput cnorm 2>/dev/null || true
    
    case $status in
        "success")
            printf "\r${CLEAR_LINE}${CYAN}│   ├──${NC} ${GREEN}✅${NC} ${message}\n"
            ;;
        "warning")
            printf "\r${CLEAR_LINE}${CYAN}│   ├──${NC} ${YELLOW}⚠️${NC} ${message}\n"
            ;;
        "error")
            printf "\r${CLEAR_LINE}${CYAN}│   ├──${NC} ${RED}❌${NC} ${message}\n"
            ;;
        *)
            printf "\r${CLEAR_LINE}${CYAN}│   ├──${NC} ${message}\n"
            ;;
    esac
}

cleanup_spinner_on_exit() {
    if [ -n "$SPINNER_PID" ]; then
        kill $SPINNER_PID 2>/dev/null || true
        wait $SPINNER_PID 2>/dev/null || true
    fi
    tput cnorm 2>/dev/null || true
}
trap cleanup_spinner_on_exit EXIT

# 병렬 배포 상태 관리 전용
DEPLOY_STATUS_DIR="/tmp/deploy-status-$$"
USE_PARALLEL_DEPLOY=true
[ -t 1 ] && USE_SINGLE_LINE=true || USE_SINGLE_LINE=false

show_deployment_status() {
    local total=${#SERVICES[@]}
    local completed=0
    local failed=0
    local max_elapsed=0

    for SVC in "${SERVICES[@]}"; do
        local status_file="${DEPLOY_STATUS_DIR}/${SVC}.status"
        local time_file="${DEPLOY_STATUS_DIR}/${SVC}.time"
        if [ -f "$status_file" ]; then
            local result=$(cat "$status_file")
            if [ "$result" == "success" ]; then ((completed++)); elif [ "$result" == "failed" ]; then ((failed++)); fi
        fi
        if [ -f "$time_file" ]; then
            local e=$(cat "$time_file" 2>/dev/null)
            [ -n "$e" ] && [ "$e" -gt "${max_elapsed:-0}" ] 2>/dev/null && max_elapsed=$e
        fi
    done

    if [ "$USE_SINGLE_LINE" != "true" ]; then return; fi

    if [ $completed -eq $total ]; then
        printf '\n'
        echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BOLD}🚀 배포 진행 상황${NC}"
        echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        for SVC in "${SERVICES[@]}"; do
            local status_file="${DEPLOY_STATUS_DIR}/${SVC}.status"
            local time_file="${DEPLOY_STATUS_DIR}/${SVC}.time"
            local status="⏳ 배포 중..."
            local color="${YELLOW}"
            local elapsed=""
            if [ -f "$status_file" ]; then
                local result=$(cat "$status_file")
                if [ "$result" == "success" ]; then status="완료      "; color="${GREEN}"; [ -f "$time_file" ] && elapsed="($(cat $time_file)초)"; elif [ "$result" == "failed" ]; then status="실패      "; color="${RED}"; [ -f "$time_file" ] && elapsed="($(cat $time_file)초)"; fi
            elif [ -f "$time_file" ]; then elapsed="($(cat $time_file)초)"; fi
            local svc_disp=$(printf "%-12s" "$SVC")
            echo -e "  ${color}${svc_disp}${NC} ${status} ${elapsed}"
        done
        echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "  ${GREEN}${BOLD}✨ 모든 서비스 배포가 완료되었습니다!${NC}"
        echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        return
    fi

    local parts=""
    for SVC in "${SERVICES[@]}"; do
        local status_file="${DEPLOY_STATUS_DIR}/${SVC}.status"
        local s="⏳"
        if [ -f "$status_file" ]; then
            local r=$(cat "$status_file")
            [ "$r" == "success" ] && s="✅"
            [ "$r" == "failed" ] && s="❌"
        fi
        parts="${parts} ${s} ${SVC}"
    done
    printf "\r${CLEAR_LINE}${CYAN}🔄${NC} 배포 진행... %d/%d 완료 |%s | %ds\r" "$completed" "$total" "$parts" "$max_elapsed"
}

monitor_deployment_status() {
    local pids=("$@")
    local total=${#SERVICES[@]}
    while true; do
        local all_done=true
        for pid in "${pids[@]}"; do
            if kill -0 "$pid" 2>/dev/null; then all_done=false; break; fi
        done

        for SVC in "${SERVICES[@]}"; do
            local start_file="${DEPLOY_STATUS_DIR}/${SVC}.start"
            local time_file="${DEPLOY_STATUS_DIR}/${SVC}.time"
            local status_file="${DEPLOY_STATUS_DIR}/${SVC}.status"
            if [ -f "$start_file" ] && [ ! -f "$status_file" ]; then
                local start_time=$(cat "$start_file")
                local current_time=$(date +%s)
                echo $((current_time - start_time)) > "$time_file"
            fi
        done

        show_deployment_status
        if $all_done; then break; fi
        sleep 1
    done
}

# 배포 단계 카운터 (상태 메시지용)
TOTAL_STEPS=12
CURRENT_STEP=0

# 제대로 안 뜬 Pod의 ReplicaSet 삭제 (Deployment가 새 ReplicaSet 생성)
# usage: delete_unhealthy_replicasets <namespace> [label]
# label 생략 시 해당 네임스페이스 전체
# Properly delete unhealthy ReplicaSets
delete_unhealthy_replicasets() {
    # 전체 함수의 stderr를 /dev/null로 리다이렉트
    {
        local ns="$1"
        local label="${2:-}"
        
        # 비정상 상태의 Pod 직접 삭제 (ReplicaSet을 통하지 않고)
        # 이 방식이 더 안전하고 에러가 없음
        local delete_cmd="kubectl -n ${ns} delete pods --field-selector=status.phase!=Running,status.phase!=Succeeded --grace-period=0 --force --ignore-not-found"
        [ -n "$label" ] && delete_cmd="$delete_cmd -l $label"
        
        # 모든 출력 완전 억제
        $delete_cmd >/dev/null 2>&1 || true
        
        # ImagePullBackOff, CrashLoopBackOff 등의 Pod도 삭제
        # (위의 field-selector로 잡히지 않는 경우를 위해)
        if [ -n "$label" ]; then
            kubectl -n "$ns" get pods -l "$label" --no-headers 2>/dev/null | \
            grep -E "ImagePullBackOff|CrashLoopBackOff|ErrImagePull|Error|Evicted|OOMKilled|CreateContainerConfigError" | \
            awk '{print $1}' | \
            while IFS= read -r pod_name; do
                [ -z "$pod_name" ] && continue
                # pod/ 접두사 제거
                pod_name="${pod_name#pod/}"
                # 공백 제거
                pod_name=$(echo "$pod_name" | tr -d '[:space:]')
                [ -z "$pod_name" ] && continue
                # Pod 삭제 (모든 에러 무시)
                kubectl -n "$ns" delete pod "$pod_name" --grace-period=0 --force --ignore-not-found 2>&1 || true
            done
        else
            kubectl -n "$ns" get pods --no-headers 2>/dev/null | \
            grep -E "ImagePullBackOff|CrashLoopBackOff|ErrImagePull|Error|Evicted|OOMKilled|CreateContainerConfigError" | \
            awk '{print $1}' | \
            while IFS= read -r pod_name; do
                [ -z "$pod_name" ] && continue
                # pod/ 접두사 제거
                pod_name="${pod_name#pod/}"
                # 공백 제거
                pod_name=$(echo "$pod_name" | tr -d '[:space:]')
                [ -z "$pod_name" ] && continue
                # Pod 삭제 (모든 에러 무시)
                kubectl -n "$ns" delete pod "$pod_name" --grace-period=0 --force --ignore-not-found 2>&1 || true
            done
        fi
    } 2>/dev/null
}

# Pod 상태 실시간 표시 (깔끔한 버전)
# Pod 상태 실시간 표시 (트리 스타일)
show_pod_status() {
    local namespace="$1"
    local label="$2"
    local timeout="$3"
    local description="$4"
    
    local elapsed=0
    local interval=2
    local error_count=0  # 연속 에러 카운트
    
    while [ $elapsed -lt $timeout ]; do
        local total_pods=$(kubectl get pods -n $namespace -l $label --no-headers 2>/dev/null | grep -vE "Completed|Succeeded" | wc -l | tr -d ' ')
        local running_pods=$(kubectl get pods -n $namespace -l $label --no-headers 2>/dev/null | grep "Running" | wc -l | tr -d ' ')
        local ready_pods=$(kubectl get pods -n $namespace -l $label --no-headers 2>/dev/null | awk '$2 ~ /^[0-9]+\/[0-9]+$/ {split($2,a,"/"); if(a[1]==a[2]) print}' | wc -l | tr -d ' ')
        
        if [ "$total_pods" -eq 0 ]; then
             printf "\r${CLEAR_LINE}${CYAN}│   ├──${NC} 🔄 ${description}: 대기 중 ${DIM}(${elapsed}/${timeout}s)${NC}"
        elif [ "$ready_pods" -eq "$total_pods" ] && [ "$running_pods" -eq "$total_pods" ]; then
            printf "\r${CLEAR_LINE}${CYAN}│   ├──${NC} ${GREEN}✅${NC} ${description}: 준비 완료 (${total_pods}ea) ${DIM}(${elapsed}s)${NC}\n"
            return 0
        else
            local error_pods=$(kubectl get pods -n $namespace -l $label --no-headers 2>/dev/null | grep -E "ImagePullBackOff|ErrImagePull|CrashLoopBackOff" | wc -l | tr -d ' ')
            
            # 에러 Pod가 있으면 카운트 증가, 없으면 리셋
            if [ "$error_pods" -gt 0 ]; then
                error_count=$((error_count + 1))
                # 연속 3회 이상 에러가 감지되면 실패로 처리 (6초 이상 지속)
                if [ $error_count -ge 3 ]; then
                    local error_status=$(kubectl get pods -n $namespace -l $label --no-headers 2>/dev/null | grep -E "ImagePullBackOff|ErrImagePull|CrashLoopBackOff" | head -1 | awk '{print $3}')
                    printf "\r${CLEAR_LINE}${CYAN}│   ├──${NC} ${RED}❌${NC} ${description}: ${error_status}\n"
                    return 1
                fi
            else
                error_count=0
            fi
            
            printf "\r${CLEAR_LINE}${CYAN}│   ├──${NC} 🔄 ${description}: ${ready_pods}/${total_pods} Ready ${DIM}(${elapsed}/${timeout}s)${NC}"
        fi
        
        sleep $interval
        elapsed=$((elapsed + interval))
    done
    
    printf "\r${CLEAR_LINE}${CYAN}│   ├──${NC} ${YELLOW}⚠️${NC} ${description}: 타임아웃 ${DIM}(${timeout}s)${NC}\n"
    return 1
}

log_section "로컬 환경 배포 시작"
log_task "환경: Kind 클러스터 (4-Node)"
log_task "DB: PostgreSQL"
log_task "메시징: Strimzi Kafka"

# 사전 검증
log_section "배포 환경 검증"

# kubectl 설치 확인
if ! command -v kubectl &> /dev/null; then
    log_task "kubectl 미설치"
    log_error "kubectl이 설치되어 있지 않습니다."
    echo "   설치 가이드: https://kubernetes.io/docs/tasks/tools/"
    exit 1
fi
log_task "kubectl 설치 확인됨"

# Helm 설치 확인
# Helm 설치 확인
if ! command -v helm &> /dev/null; then
    log_task "Helm 미설치"
    log_error "Helm이 설치되어 있지 않습니다."
    log_info "Helm은 Redis 배포에 필요합니다."
    
    OS=$(uname -s)
    if [ "$OS" == "Darwin" ]; then
        log_info "macOS: brew install helm"
        read -p "지금 설치하시겠습니까? (Y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            if command -v brew &> /dev/null; then
                brew install helm
            else
                log_error "Homebrew가 필요합니다."
                exit 1
            fi
        else
            exit 1
        fi
    else
        log_info "Linux: curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash"
        exit 1
    fi
fi

# 현재 컨텍스트가 Kind 클러스터인지 확인 (클러스터가 없으면 자동 생성)
CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "")
EXPECTED_CONTEXT="kind-unbrdn-local"

if [[ "$CURRENT_CONTEXT" != "$EXPECTED_CONTEXT" ]]; then
    log_warning "현재 쿠버네티스 컨텍스트가 Kind 클러스터가 아닙니다."
    log_info "현재: ${CURRENT_CONTEXT:-없음} / 예상: ${EXPECTED_CONTEXT}"
    
    # Kind 클러스터 존재 확인
    if kubectl config get-contexts "$EXPECTED_CONTEXT" &> /dev/null; then
        # 클러스터는 있지만 컨텍스트가 다름
        read -p "${EXPECTED_CONTEXT}로 전환하시겠습니까? (Y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            kubectl config use-context "$EXPECTED_CONTEXT"
            log_success "컨텍스트를 '${EXPECTED_CONTEXT}'로 전환했습니다."
        else
            log_error "배포를 중단합니다."
            exit 1
        fi
    else
        # Kind 클러스터가 없음 - Kind 설치 여부부터 확인
        log_error "Kind 클러스터를 찾을 수 없습니다."
        
        # Kind 설치 여부 확인
        if ! command -v kind &> /dev/null; then
            log_error "Kind가 설치되어 있지 않습니다."
            log_task "Kind 설치 필요"
            
            # 운영체제 감지
            OS=$(uname -s)
            if [ "$OS" == "Darwin" ]; then
                # macOS
                log_info "macOS 감지 - Homebrew로 자동 설치 가능"
                read -p "Kind를 지금 설치하시겠습니까? (Y/n): " -n 1 -r
                echo
                
                if [[ ! $REPLY =~ ^[Nn]$ ]]; then
                    if command -v brew &> /dev/null; then
                        log_task "Homebrew로 Kind 설치 중..."
                        if ! brew install kind; then
                            log_error "Kind 설치에 실패했습니다."
                            exit 1
                        fi
                        log_success "Kind 설치가 완료되었습니다."
                    else
                        log_error "Homebrew가 설치되어 있지 않습니다."
                        log_info "수동설치: brew install kind"
                        exit 1
                    fi
                else
                    log_warning "배포를 중단합니다."
                    exit 1
                fi
            else
                # Linux
                log_info "Linux 감지 - 수동 설치 필요"
                exit 1
            fi
        fi
        
        # Kind가 설치되어 있으면 클러스터 생성 제안
        log_task "Kind 클러스터를 생성해야 합니다."
        read -p "Kind 클러스터를 지금 생성하시겠습니까? (Y/n): " -n 1 -r
        echo
        
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            if [ -f "./scripts/setup-kind-local.sh" ]; then
                log_task "Kind 클러스터 생성 중..."
                if ! ./scripts/setup-kind-local.sh; then
                    log_error "Kind 클러스터 생성에 실패했습니다."
                    exit 1
                fi
                
                log_success "Kind 클러스터가 생성되었습니다."
                
                # 컨텍스트 전환
                kubectl config use-context "$EXPECTED_CONTEXT" &>/dev/null
                
                # 노드가 Ready 상태가 될 때까지 대기
                log_task "노드 Ready 대기 중..."
                NODE_READY_WAIT=180
                node_ready_elapsed=0
                EXPECTED_NODES=4
                READY_COUNT=0
                while [ $node_ready_elapsed -lt $NODE_READY_WAIT ]; do
                    READY_COUNT=$(kubectl get nodes --no-headers 2>/dev/null | grep -c " Ready " || echo "0")
                    if [ "$READY_COUNT" -ge "$EXPECTED_NODES" ]; then
                        log_success "모든 노드가 Ready 상태입니다: ${READY_COUNT}/${EXPECTED_NODES}"
                        break
                    fi
                    if [ $((node_ready_elapsed % 10)) -eq 0 ] && [ "$node_ready_elapsed" -gt 0 ]; then
                        log_info "Ready: ${READY_COUNT}/${EXPECTED_NODES} (${node_ready_elapsed}초 경과)..."
                    fi
                    sleep 2
                    node_ready_elapsed=$((node_ready_elapsed + 2))
                done
                if [ "${READY_COUNT:-0}" -lt "$EXPECTED_NODES" ]; then
                    log_warning "일부 노드가 아직 Ready 상태가 아닙니다: ${READY_COUNT:-0}/${EXPECTED_NODES}"
                fi
            else
                log_error "setup-kind-local.sh 파일을 찾을 수 없습니다."
                exit 1
            fi
        else
            log_warning "배포를 중단합니다."
            exit 1
        fi
    fi
fi

# Kind 클러스터 노드 확인
# log_task "Kind 클러스터 노드 확인 중..." # (너무 자세한 로그 생략)
NODE_COUNT=$(kubectl get nodes --no-headers 2>/dev/null | wc -l | tr -d ' ')
if [ "$NODE_COUNT" -lt 4 ]; then
    log_warning "예상 노드 수: 4개 / 현재: ${NODE_COUNT}개"
    log_info "Kind 클러스터를 재생성하세요: kind delete cluster --name unbrdn-local"
    
    read -p "현재 클러스터로 계속 진행하시겠습니까? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    log_success "Kind 클러스터 노드 정상: ${NODE_COUNT}개"
fi

# 노드가 Ready 상태인지 확인 및 대기
READY_COUNT=$(kubectl get nodes --no-headers 2>/dev/null | grep -c " Ready " || echo "0")
if [ "$READY_COUNT" -lt "$NODE_COUNT" ]; then
    log_task "노드 Ready 대기 중..."
    NODE_READY_WAIT=120
    node_ready_elapsed=0
    while [ $node_ready_elapsed -lt $NODE_READY_WAIT ]; do
        READY_COUNT=$(kubectl get nodes --no-headers 2>/dev/null | grep -c " Ready " || echo "0")
        if [ "$READY_COUNT" -ge "$NODE_COUNT" ]; then
            log_success "모든 노드가 Ready 상태입니다: ${READY_COUNT}/${NODE_COUNT}"
            break
        fi
        sleep 2
        node_ready_elapsed=$((node_ready_elapsed + 2))
    done
fi

# Docker 이미지 빌드 및 Kind 로드 (자동 통합)
log_section "Docker 이미지 빌드 및 클러스터 로드"

if [ -f "./scripts/build-images-local.sh" ]; then
    log_task "이미지 빌드 시작..."
    # 배포 대상 서비스만 빌드 (인자가 없으면 전체 빌드, 메뉴 스킵)
    if ! ./scripts/build-images-local.sh --skip-menu "${SELECTED_SERVICES[@]}"; then
        log_error "이미지 빌드에 실패했습니다. 배포를 중단합니다."
        exit 1
    fi
    log_success "이미지 빌드 완료"
    
    log_task "Kind 클러스터에 이미지 로드 및 재시작 중..."
    for SVC in "${SERVICES[@]}"; do
        IMAGE="${SVC}:latest"
        start_spinner "로드 중: ${IMAGE}"
        if kind load docker-image "$IMAGE" --name unbrdn-local >/dev/null 2>&1; then
             stop_spinner "success" "로드 완료: ${IMAGE}"
             # 강제 재시작 추가
             kubectl rollout restart deployment/${SVC} -n ${NAMESPACE} >/dev/null 2>&1 || true
        else
             stop_spinner "warning" "로드 실패 또는 이미 존재. 강제 재시작 시도..."
             kubectl rollout restart deployment/${SVC} -n ${NAMESPACE} >/dev/null 2>&1 || true
        fi
    done
else
    log_error "build-images-local.sh 파일을 찾을 수 없습니다."
    exit 1
fi

log_success "배포 환경 검증 완료"

# 배포 전 실패·비정상 Pod 정리 (삭제 시 컨트롤러가 재생성)
start_spinner "실패·비정상 Pod 정리 중..."
for NS in "${NAMESPACE}" "${KAFKA_NAMESPACE}" "${MONITORING_NAMESPACE}"; do
    if kubectl get namespace "${NS}" &> /dev/null; then
        # Failed, Unknown, Succeeded 상태 Pod 삭제
        kubectl -n ${NS} delete pods --field-selector=status.phase=Failed --grace-period=0 --force &>/dev/null || true
        kubectl -n ${NS} delete pods --field-selector=status.phase=Unknown --grace-period=0 --force &>/dev/null || true
        kubectl -n ${NS} delete pods --field-selector=status.phase=Succeeded --grace-period=0 --force &>/dev/null || true

        # Evicted Pod 삭제 (macOS 호환: xargs -r 대신 조건부 실행)
        # pod/name 형식 방지: sed로 pod/ prefix 제거
        evicted_pods=$(kubectl -n ${NS} get pods 2>/dev/null | grep "Evicted" | awk '{print $1}' | sed 's|^pod/||' || true)
        if [ -n "$evicted_pods" ]; then
            echo "$evicted_pods" | xargs -I {} kubectl -n ${NS} delete pod {} --grace-period=0 --force &>/dev/null || true
        fi

        # ContainerStatusUnknown Pod 삭제
        unknown_pods=$(kubectl -n ${NS} get pods 2>/dev/null | grep "ContainerStatusUnknown" | awk '{print $1}' | sed 's|^pod/||' || true)
        if [ -n "$unknown_pods" ]; then
            echo "$unknown_pods" | xargs -I {} kubectl -n ${NS} delete pod {} --grace-period=0 --force &>/dev/null || true
        fi

        # 제대로 안 뜬 Pod의 ReplicaSet 삭제 (Deployment가 새 ReplicaSet 생성)
        delete_unhealthy_replicasets "${NS}" ""
    fi
done
stop_spinner "success" "실패·비정상 Pod 정리 완료"
echo ""

# Step 1: 네임스페이스 생성
log_section "인프라 배포"

log_task "네임스페이스 생성 중..."
kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml 2>/dev/null | kubectl apply -f - >/dev/null 2>&1
kubectl create namespace ${KAFKA_NAMESPACE} --dry-run=client -o yaml 2>/dev/null | kubectl apply -f - >/dev/null 2>&1
kubectl create namespace ${MONITORING_NAMESPACE} --dry-run=client -o yaml 2>/dev/null | kubectl apply -f - >/dev/null 2>&1
log_success "네임스페이스 확인 완료"

# =============================================================================
# Strimzi Operator 확인 및 설치
# =============================================================================

# log_task "Strimzi Kafka Operator 확인 중..."
if ! kubectl get deployment strimzi-cluster-operator -n "${KAFKA_NAMESPACE}" &> /dev/null; then
    log_warning "Strimzi Operator가 설치되어 있지 않습니다!"
    log_info "설치 방법: ./scripts/setup-strimzi-local.sh"
    
    read -p "지금 설치하시겠습니까? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        log_task "Strimzi Operator 설치 중..."
        ./scripts/setup-strimzi-local.sh
    else
        log_warning "Kafka 클러스터가 생성되지 않습니다."
    fi
else
    log_success "Strimzi Operator 설치 확인됨"
fi

# =============================================================================
# 1. 인프라 배포 (병렬)
# =============================================================================

log_section "인프라 배포 (병렬)"

# 병렬 배포를 위해 서비스 목록 교체
APP_SERVICES=("${SERVICES[@]}")
APP_SERVICE_LABELS=("${SERVICE_LABELS[@]}")

SERVICES=("postgres" "mongo" "redis" "kafka" "minio")
# Label은 모니터링용 (선택적)
SERVICE_LABELS=("app=postgres" "app=mongo" "app.kubernetes.io/name=redis" "strimzi.io/cluster=kafka-cluster" "app=minio")

mkdir -p "${DEPLOY_STATUS_DIR}"
INFRA_PIDS=()

# 1. PostgreSQL
(
    SERVICE="postgres"
    echo "$(date +%s)" > "${DEPLOY_STATUS_DIR}/${SERVICE}.start"
    SUCCESS=true
    LOG_FILE="${DEPLOY_STATUS_DIR}/${SERVICE}.log"
    
    {
        if [ -d "k8s/infra/postgres/local" ]; then
            kubectl apply -f k8s/infra/postgres/local/ > "$LOG_FILE" 2>&1
        elif [ -d "k8s/infra/oracle" ]; then
            kubectl apply -f k8s/infra/oracle/ > "$LOG_FILE" 2>&1
        fi
        
        # 대기 (PVC 프로비저닝 시간 고려하여 120초로 상향)
        if ! show_pod_status "${NAMESPACE}" "app=postgres" 120 "PostgreSQL" >/dev/null 2>&1; then
            SUCCESS=false
        fi
        
        # Port Forwarding
        if [ "$SUCCESS" = true ]; then
            if ! ps aux | grep -v grep | grep -q "port-forward svc/postgres 5432:5432"; then
                nohup kubectl port-forward svc/postgres 5432:5432 -n ${NAMESPACE} > /tmp/postgres-pf.log 2>&1 &
                sleep 1
            fi
        fi
    } || SUCCESS=false
    
    if [ "$SUCCESS" = true ]; then
        echo "success" > "${DEPLOY_STATUS_DIR}/${SERVICE}.status"
    else
        echo "failed" > "${DEPLOY_STATUS_DIR}/${SERVICE}.status"
    fi
) &
INFRA_PIDS+=($!)

# 2. MongoDB
(
    SERVICE="mongo"
    echo "$(date +%s)" > "${DEPLOY_STATUS_DIR}/${SERVICE}.start"
    SUCCESS=true
    LOG_FILE="${DEPLOY_STATUS_DIR}/${SERVICE}.log"
    
    {
        if [ -d "k8s/infra/mongo/local" ]; then
            kubectl apply -f k8s/infra/mongo/local/ > "$LOG_FILE" 2>&1
            
            if ! show_pod_status "${NAMESPACE}" "app=mongo" 60 "MongoDB" >/dev/null 2>&1; then
                SUCCESS=false
            fi
            
            if [ "$SUCCESS" = true ]; then
                if ! ps aux | grep -v grep | grep -q "port-forward svc/mongo 27017:27017"; then
                    nohup kubectl port-forward svc/mongo 27017:27017 -n ${NAMESPACE} > /tmp/mongo-pf.log 2>&1 &
                    sleep 1
                fi
            fi
        else
            # 없으면 성공 처리하되 경고 없음 (로직상)
            true
        fi
    } || SUCCESS=false

    if [ "$SUCCESS" = true ]; then
        echo "success" > "${DEPLOY_STATUS_DIR}/${SERVICE}.status"
    else
        echo "failed" > "${DEPLOY_STATUS_DIR}/${SERVICE}.status"
    fi
) &
INFRA_PIDS+=($!)

# 3. Redis
(
    SERVICE="redis"
    echo "$(date +%s)" > "${DEPLOY_STATUS_DIR}/${SERVICE}.start"
    SUCCESS=true
    LOG_FILE="${DEPLOY_STATUS_DIR}/${SERVICE}.log"
    
    {
        # Redis가 이미 정상 실행 중인지 확인 (Sentinel 구조상 3개 이상의 포드 기대)
        REDIS_RUNNING_COUNT=$(kubectl get pods -n ${NAMESPACE} -l app.kubernetes.io/name=redis --no-headers 2>/dev/null | grep "Running" | wc -l | tr -d ' ')
        
        if [ "$REDIS_RUNNING_COUNT" -lt 3 ]; then
            log_info "Redis 배포 또는 업데이트를 시작합니다..." >> "$LOG_FILE"
            # Bitnami Repo 추가 및 업데이트 (이미 있으면 건너뜀)
            helm repo add bitnami https://charts.bitnami.com/bitnami >/dev/null 2>&1 || true
            helm repo update bitnami >/dev/null 2>&1 || true
            
            # Track 1: Pub/Sub, Socket.io 어댑터, 웹소켓 세션 캐시, LLM 버퍼
            helm upgrade --install redis-track1 k8s/infra/redis/track1 \
                -n ${NAMESPACE} \
                -f k8s/infra/redis/track1/values-local.yaml \
                --dependency-update \
                --wait --timeout 300s > "$LOG_FILE" 2>&1

            # Track 2: LangGraph Checkpoint (LLM 전용)
            helm upgrade --install redis-track2 k8s/infra/redis/track2 \
                -n ${NAMESPACE} \
                -f k8s/infra/redis/track2/values-local.yaml \
                --dependency-update \
                --wait --timeout 300s >> "$LOG_FILE" 2>&1

            # Track 3: 인터뷰 세션 상태, Sentence Stream (prod: Azure Cache for Redis)
            helm upgrade --install redis-track3 k8s/infra/redis/track3 \
                -n ${NAMESPACE} \
                --dependency-update \
                --wait --timeout 300s >> "$LOG_FILE" 2>&1
            
            REDIS_TIMEOUT=300
            REDIS_ELAPSED=0
            while [ $REDIS_ELAPSED -lt $REDIS_TIMEOUT ]; do
                # Redis Pod 개수 확인 (ready 상태)
                REDIS_READY=$(kubectl get pods -n ${NAMESPACE} -l app.kubernetes.io/name=redis --no-headers 2>/dev/null | grep "Running" | wc -l | tr -d ' ')
                
                if [ "$REDIS_READY" -ge 3 ]; then
                    break
                fi
                sleep 5
                REDIS_ELAPSED=$((REDIS_ELAPSED + 5))
            done
            
            if [ $REDIS_ELAPSED -ge $REDIS_TIMEOUT ]; then
                SUCCESS=false
                echo "Redis deployment timed out" >> "$LOG_FILE"
            fi
        else
            echo "Redis is already running with $REDIS_RUNNING_COUNT replicas. Skipping deployment." >> "$LOG_FILE"
        fi
        
        # Redis Insight (상태와 무관하게 확인/적용)
        if [ -f "k8s/infra/redis-insight/prod/redis-insight.yaml" ]; then
            kubectl apply -f k8s/infra/redis-insight/prod/redis-insight.yaml >/dev/null 2>&1
        elif [ -f "k8s/infra/redis/redis-insight.yaml" ]; then
            kubectl apply -f k8s/infra/redis/redis-insight.yaml >/dev/null 2>&1
        fi
    } || SUCCESS=false

    if [ "$SUCCESS" = true ]; then
        echo "success" > "${DEPLOY_STATUS_DIR}/${SERVICE}.status"
    else
        echo "failed" > "${DEPLOY_STATUS_DIR}/${SERVICE}.status"
    fi
) &
INFRA_PIDS+=($!)

# 4. Kafka
(
    SERVICE="kafka"
    echo "$(date +%s)" > "${DEPLOY_STATUS_DIR}/${SERVICE}.start"
    SUCCESS=true
    LOG_FILE="${DEPLOY_STATUS_DIR}/${SERVICE}.log"
    
    {
        # Apply Manifests
        if [ -d "k8s/infra/kafka/common" ]; then
            kubectl apply -f k8s/infra/kafka/common/ > "$LOG_FILE" 2>&1
        fi
        if [ -d "k8s/infra/kafka/local" ]; then
            for f in kafka-nodepool.yaml kafka-ui-deployment.yaml kafka-ui-service.yaml kafka-ui-externalname.yaml; do
                [ -f "k8s/infra/kafka/local/$f" ] && kubectl apply -f "k8s/infra/kafka/local/$f" >> "$LOG_FILE" 2>&1
            done
        fi
        
        # Wait for Ready
        KAFKA_TIMEOUT=300
        KAFKA_ELAPSED=0
        while [ $KAFKA_ELAPSED -lt $KAFKA_TIMEOUT ]; do
            KAFKA_STATUS=$(kubectl get kafka kafka-cluster -n ${KAFKA_NAMESPACE} -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
            if [ "$KAFKA_STATUS" == "True" ]; then
                break
            fi
            sleep 3
            KAFKA_ELAPSED=$((KAFKA_ELAPSED + 3))
        done
        if [ $KAFKA_ELAPSED -ge $KAFKA_TIMEOUT ]; then
            SUCCESS=false
        fi
    } || SUCCESS=false

    if [ "$SUCCESS" = true ]; then
        echo "success" > "${DEPLOY_STATUS_DIR}/${SERVICE}.status"
    else
        echo "failed" > "${DEPLOY_STATUS_DIR}/${SERVICE}.status"
    fi
) &
INFRA_PIDS+=($!)

# 5. MinIO
(
    SERVICE="minio"
    echo "$(date +%s)" > "${DEPLOY_STATUS_DIR}/${SERVICE}.start"
    SUCCESS=true
    LOG_FILE="${DEPLOY_STATUS_DIR}/${SERVICE}.log"
    
    {
        if [ -d "k8s/infra/minio" ]; then
            kubectl apply -f k8s/infra/minio/ > "$LOG_FILE" 2>&1
            
            # Wait Pod
            MINIO_TIMEOUT=120
            MINIO_ELAPSED=0
            while [ $MINIO_ELAPSED -lt $MINIO_TIMEOUT ]; do
                MINIO_READY=$(kubectl get pods -n ${NAMESPACE} -l app=minio --no-headers 2>/dev/null | grep "Running" | wc -l | tr -d ' ')
                if [ "$MINIO_READY" -ge 1 ]; then
                    break
                fi
                sleep 3
                MINIO_ELAPSED=$((MINIO_ELAPSED + 3))
            done
            if [ $MINIO_ELAPSED -ge $MINIO_TIMEOUT ]; then
                SUCCESS=false
            else
                # Bucket Job
                if [ -f "k8s/infra/minio/job-create-bucket.yaml" ]; then
                    kubectl apply -f k8s/infra/minio/job-create-bucket.yaml >/dev/null 2>&1
                fi
            fi
        fi
    } || SUCCESS=false

    if [ "$SUCCESS" = true ]; then
        echo "success" > "${DEPLOY_STATUS_DIR}/${SERVICE}.status"
    else
        echo "failed" > "${DEPLOY_STATUS_DIR}/${SERVICE}.status"
    fi
) &
INFRA_PIDS+=($!)

# 모니터링 시작
monitor_deployment_status "${INFRA_PIDS[@]}"

# 서비스 목록 복구 (앱 배포용)
SERVICES=("${APP_SERVICES[@]}")
SERVICE_LABELS=("${APP_SERVICE_LABELS[@]}")

# 로그 정리 (선택적)
# rm -f "${DEPLOY_STATUS_DIR}"/*.log

echo ""

# =============================================================================
# 2. Secrets 확인 및 입력 생성
# =============================================================================

ensure_secret() {
  local name="$1"
  kubectl get secret "$name" -n "${NAMESPACE}" &>/dev/null
}

create_secret_llm() {
  log_task "LLM Secret (OPENAI_API_KEY)"
  read -sp "OpenAI API Key 입력 (Enter=건너뛰기): " val
  echo
  if [ -n "$val" ]; then
    kubectl create secret generic llm-secrets \
      --from-literal=OPENAI_API_KEY="$val" \
      --namespace="${NAMESPACE}" \
      --dry-run=client -o yaml 2>/dev/null | kubectl apply -f - >/dev/null 2>&1
    log_success "llm-secrets 생성됨"
  else
    log_warning "LLM Secret 건너뜀 (Pod 실패 가능)"
  fi
}

create_secret_stt() {
  log_task "STT Secret (OPENAI_API_KEY)"
  read -sp "OpenAI API Key 입력 (Enter=LLM과 동일 키 사용, 이미 있으면 건너뛰기): " val
  echo
  if [ -n "$val" ]; then
    kubectl create secret generic stt-secrets \
      --from-literal=OPENAI_API_KEY="$val" \
      --namespace="${NAMESPACE}" \
      --dry-run=client -o yaml 2>/dev/null | kubectl apply -f - >/dev/null 2>&1
    log_success "stt-secrets 생성됨"
  elif kubectl get secret llm-secrets -n "${NAMESPACE}" -o jsonpath='{.data.OPENAI_API_KEY}' 2>/dev/null | b64dec 2>/dev/null | grep -q .; then
    local key
    key=$(kubectl get secret llm-secrets -n "${NAMESPACE}" -o jsonpath='{.data.OPENAI_API_KEY}' 2>/dev/null | b64dec 2>/dev/null || echo "")
    kubectl create secret generic stt-secrets \
      --from-literal=OPENAI_API_KEY="$key" \
      --namespace="${NAMESPACE}" \
      --dry-run=client -o yaml 2>/dev/null | kubectl apply -f - >/dev/null 2>&1
    log_success "stt-secrets 생성됨 (LLM 키 복사)"
  else
    log_warning "STT Secret 건너뜀"
  fi
}

create_secret_tts() {
  log_task "TTS Secret (OPENAI_API_KEY)"
  read -sp "OpenAI API Key 입력 (Enter=LLM과 동일 키 사용, 이미 있으면 건너뛰기): " val
  echo
  if [ -n "$val" ]; then
    kubectl create secret generic tts-secrets \
      --from-literal=OPENAI_API_KEY="$val" \
      --namespace="${NAMESPACE}" \
      --dry-run=client -o yaml 2>/dev/null | kubectl apply -f - >/dev/null 2>&1
    log_success "tts-secrets 생성됨"
  elif kubectl get secret llm-secrets -n "${NAMESPACE}" -o jsonpath='{.data.OPENAI_API_KEY}' 2>/dev/null | b64dec 2>/dev/null | grep -q .; then
    local key
    key=$(kubectl get secret llm-secrets -n "${NAMESPACE}" -o jsonpath='{.data.OPENAI_API_KEY}' 2>/dev/null | b64dec 2>/dev/null || echo "")
    kubectl create secret generic tts-secrets \
      --from-literal=OPENAI_API_KEY="$key" \
      --namespace="${NAMESPACE}" \
      --dry-run=client -o yaml 2>/dev/null | kubectl apply -f - >/dev/null 2>&1
    log_success "tts-secrets 생성됨 (LLM 키 복사)"
  else
    log_warning "TTS Secret 건너뜀"
  fi
}

create_secret_storage() {
  log_task "Storage Secret (MinIO/OCI Object Storage)"
  log_info "로컬 MinIO 기본값: minioadmin / minioadmin"
  read -p "OBJECT_STORAGE_ACCESS_KEY (Enter=minioadmin): " access
  access="${access:-minioadmin}"
  read -sp "OBJECT_STORAGE_SECRET_KEY (Enter=minioadmin): " secret
  echo
  secret="${secret:-minioadmin}"
  kubectl create secret generic storage-secrets \
    --from-literal=OBJECT_STORAGE_ACCESS_KEY="$access" \
    --from-literal=OBJECT_STORAGE_SECRET_KEY="$secret" \
    --namespace="${NAMESPACE}" \
    --dry-run=client -o yaml 2>/dev/null | kubectl apply -f - >/dev/null 2>&1
  log_success "storage-secrets 생성됨"
}

create_secret_bff_google() {
  log_task "BFF Google OAuth Credentials"
  read -p "GOOGLE_CLIENT_ID: " client_id
  read -sp "GOOGLE_CLIENT_SECRET: " client_secret
  echo
  if [ -z "$client_id" ] || [ -z "$client_secret" ]; then
    log_warning "Google OAuth Secret 건너뜀 (Google 로그인 불가)"
    return
  fi
  kubectl create secret generic bff-google-secrets \
    --from-literal=GOOGLE_CLIENT_ID="$client_id" \
    --from-literal=GOOGLE_CLIENT_SECRET="$client_secret" \
    --namespace="${NAMESPACE}" \
    --dry-run=client -o yaml 2>/dev/null | kubectl apply -f - >/dev/null 2>&1
  log_success "bff-google-secrets 생성됨"
}

create_secret_oracle() {
  log_task "Oracle DB Credentials"
  read -p "DB Username (Enter=ADMIN): " user
  user="${user:-ADMIN}"
  read -sp "DB Password: " pass
  echo
  if [ -z "$pass" ]; then
    log_warning "비밀번호 없음. oracle-db-credentials 건너뜀 (Core Pod 실패 가능)"
    return
  fi
  kubectl create secret generic oracle-db-credentials \
    --from-literal=username="$user" \
    --from-literal=password="$pass" \
    --namespace="${NAMESPACE}" \
    --dry-run=client -o yaml 2>/dev/null | kubectl apply -f - >/dev/null 2>&1
  log_success "oracle-db-credentials 생성됨"
}

create_secret_core_jwt() {
  log_task "Core JWT Keys (RSA 2048, 자동 생성)"
  local tmpdir
  tmpdir=$(mktemp -d)
  if ! openssl genrsa -out "${tmpdir}/jwt-private.pem" 2048 2>/dev/null; then
    rm -rf "${tmpdir}"
    log_warning "openssl 실패. core-jwt-keys 건너뜀"
    return
  fi
  if ! openssl rsa -in "${tmpdir}/jwt-private.pem" -pubout -out "${tmpdir}/jwt-public.pem" 2>/dev/null; then
    rm -rf "${tmpdir}"
    log_warning "공개키 생성 실패. core-jwt-keys 건너뜀"
    return
  fi
  local priv pub
  # PEM 헤더/푸터 제거 (플랫폼 호환)
  priv=$(grep -v "BEGIN\|END" "${tmpdir}/jwt-private.pem" | tr -d '\n')
  pub=$(grep -v "BEGIN\|END" "${tmpdir}/jwt-public.pem" | tr -d '\n')
  rm -rf "${tmpdir}"
  kubectl create secret generic core-jwt-keys \
    --from-literal=JWT_KEY_0_KID='jwt-key-0' \
    --from-literal=JWT_KEY_0_PRIVATE_KEY="$priv" \
    --from-literal=JWT_KEY_0_PUBLIC_KEY="$pub" \
    --from-literal=JWT_KEY_0_ACTIVE='true' \
    --namespace="${NAMESPACE}" \
    --dry-run=client -o yaml 2>/dev/null | kubectl apply -f - >/dev/null 2>&1
  log_success "core-jwt-keys 생성됨"
}

create_secret_minio() {
  log_task "MinIO Credentials (로컬 Object Storage)"
  read -p "MINIO_ROOT_USER (Enter=minioadmin): " mu
  mu="${mu:-minioadmin}"
  read -sp "MINIO_ROOT_PASSWORD (Enter=minioadmin): " mp
  echo
  mp="${mp:-minioadmin}"
  kubectl create secret generic minio-credentials \
    --from-literal=MINIO_ROOT_USER="$mu" \
    --from-literal=MINIO_ROOT_PASSWORD="$mp" \
    --namespace="${NAMESPACE}" \
    --dry-run=client -o yaml 2>/dev/null | kubectl apply -f - >/dev/null 2>&1
  log_success "minio-credentials 생성됨"
}

log_section "Secrets"
# echo "🔐 Secrets 확인 및 입력"

MISSING_SECRETS=()
set +e  # 배열 추가를 위해 일시적으로 set -e 비활성화
ensure_secret "llm-secrets"         || MISSING_SECRETS+=("llm-secrets")
ensure_secret "stt-secrets"         || MISSING_SECRETS+=("stt-secrets")
ensure_secret "tts-secrets"         || MISSING_SECRETS+=("tts-secrets")
ensure_secret "storage-secrets"     || MISSING_SECRETS+=("storage-secrets")
# oracle-db-credentials: 로컬 환경에서는 PostgreSQL 사용하므로 불필요
# ensure_secret "oracle-db-credentials" || MISSING_SECRETS+=("oracle-db-credentials")
ensure_secret "core-jwt-keys"       || MISSING_SECRETS+=("core-jwt-keys")
ensure_secret "bff-google-secrets"  || MISSING_SECRETS+=("bff-google-secrets")
set -e  # 다시 set -e 활성화
# minio-credentials: MinIO 배포 시 사용, 없으면 기본 생성

if [ ${#MISSING_SECRETS[@]} -gt 0 ]; then
  log_warning "누락된 Secrets: ${MISSING_SECRETS[*]}"
  
  read -p "배포 시 입력으로 생성하시겠습니까? (Y/n): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Nn]$ ]]; then
    log_error "배포를 중단합니다. docs/local-secrets-guide.md 참고 후 수동 생성하세요."
    exit 1
  fi

  ensure_secret "llm-secrets"         || create_secret_llm
  ensure_secret "stt-secrets"         || create_secret_stt
  ensure_secret "tts-secrets"         || create_secret_tts
  ensure_secret "storage-secrets"     || create_secret_storage
  # oracle-db-credentials: 로컬 환경에서는 PostgreSQL 사용하므로 생성하지 않음
  # ensure_secret "oracle-db-credentials" || create_secret_oracle
  ensure_secret "core-jwt-keys"       || create_secret_core_jwt
  ensure_secret "bff-google-secrets"  || create_secret_bff_google
  if ! ensure_secret "minio-credentials"; then
    log_task "MinIO Secret 확인"
    read -p "MinIO Secret도 생성하시겠습니까? (Y/n): " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Nn]$ ]] && create_secret_minio
  fi
else
  log_success "모든 필수 Secrets 존재"
fi

# =============================================================================
# 3. 애플리케이션 배포
# =============================================================================

log_section "애플리케이션 배포"

# 애플리케이션 서비스 레이블 정의 (SERVICES 배열은 상단에서 확정됨)
SERVICE_LABELS=()
for SVC in "${SERVICES[@]}"; do
    SERVICE_LABELS+=("app=${SVC}")
done

if [ ${#SELECTED_SERVICES[@]} -gt 0 ]; then
    log_info "선택된 서비스만 배포합니다: ${SERVICES[*]}"
fi

# 로컬 배포: common + local만 참조 (prod 미참조). 둘 다 없으면 에러
log_task "배포 매니페스트 검증 중..."
for SVC in "${SERVICES[@]}"; do
    if [ ! -d "k8s/apps/${SVC}/common" ]; then
        log_error "${SVC}: k8s/apps/${SVC}/common 없음"
        exit 1
    fi
    if [ ! -d "k8s/apps/${SVC}/local" ]; then
        log_error "${SVC}: k8s/apps/${SVC}/local 없음"
        exit 1
    fi
done
log_success "매니페스트 검증 완료"

log_task "서비스 배포 (병렬)..."
mkdir -p "${DEPLOY_STATUS_DIR}"
DEPLOY_PIDS=()

for i in "${!SERVICES[@]}"; do
    SERVICE=${SERVICES[$i]}
    LABEL=${SERVICE_LABELS[$i]}
    
    (
        echo "$(date +%s)" > "${DEPLOY_STATUS_DIR}/${SERVICE}.start"
        
        # Deployment 매니페스트 적용 영역
        SUCCESS=true
        {
            # common → local만 적용 (prod 미참조)
            for f in k8s/apps/${SERVICE}/common/*.yaml k8s/apps/${SERVICE}/common/*.yml; do
                [ -e "$f" ] && [[ "$f" != *example* ]] && kubectl apply -f "$f" >/dev/null 2>&1
            done
            for f in k8s/apps/${SERVICE}/local/*.yaml k8s/apps/${SERVICE}/local/*.yml; do
                [ -e "$f" ] && [[ "$f" != *example* ]] && kubectl apply -f "$f" >/dev/null 2>&1
            done
            
            # Pod 재시작 (이미지 갱신 반영)
            if kubectl get deployment ${SERVICE} -n ${NAMESPACE} &>/dev/null; then
                kubectl rollout restart deployment ${SERVICE} -n ${NAMESPACE} >/dev/null 2>&1
                
                # 가용성 대기 (병렬 내부에서 수행)
                if ! show_pod_status "${NAMESPACE}" "${LABEL}" 120 "${SERVICE}" >/dev/null 2>&1; then
                    delete_unhealthy_replicasets "${NAMESPACE}" "${LABEL}" >/dev/null 2>&1
                    sleep 3
                    if ! show_pod_status "${NAMESPACE}" "${LABEL}" 90 "${SERVICE}" >/dev/null 2>&1; then
                        SUCCESS=false
                    fi
                fi
            fi
        } || SUCCESS=false
        
        if [ "$SUCCESS" = true ]; then
            echo "success" > "${DEPLOY_STATUS_DIR}/${SERVICE}.status"
        else
            echo "failed" > "${DEPLOY_STATUS_DIR}/${SERVICE}.status"
        fi
    ) &
    DEPLOY_PIDS+=($!)
done

# 모든 배포 완료 대기 및 상태 표시
monitor_deployment_status "${DEPLOY_PIDS[@]}"
rm -rf "${DEPLOY_STATUS_DIR}"
echo ""

# Step 9: 자체 서명 인증서 생성
if ! kubectl get secret tls-secret -n ${NAMESPACE} &>/dev/null; then
    start_spinner "자체 서명 인증서 생성 중..."
    ./scripts/generate-self-signed-cert.sh >/dev/null 2>&1
    stop_spinner "success" "자체 서명 인증서 생성 완료"
else
    log_success "인증서가 이미 존재합니다"
fi

# Step 9.5: Ingress Controller 확인 및 대기
log_section "Ingress Controller"
if ! kubectl get pods -n ingress-nginx -l app.kubernetes.io/component=controller &> /dev/null; then
    log_warning "Ingress Controller가 설치되어 있지 않습니다. 설치를 시도합니다..."
    start_spinner "Ingress Controller 설치 중..."
    if kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml >/dev/null 2>&1; then
        stop_spinner "success" "Ingress Controller 매니페스트 적용 완료"
    else
        stop_spinner "error" "Ingress Controller 설치 실패"
    fi
fi

# Controller가 준비될 때까지 대기 (이미 설치된 경우에도 확인)
start_spinner "Ingress Controller 상태 확인 중..."
if kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=60s >/dev/null 2>&1; then
    stop_spinner "success" "Ingress Controller 준비됨"
else
    stop_spinner "warning" "Ingress Controller 대기 타임아웃 (백그라운드에서 초기화 중일 수 있음)"
fi

# NodePort 패치 (멱등성 유지)
kubectl patch svc ingress-nginx-controller -n ingress-nginx \
  -p '{"spec":{"type":"NodePort","ports":[{"port":80,"nodePort":30080,"protocol":"TCP","targetPort":"http"},{"port":443,"nodePort":30443,"protocol":"TCP","targetPort":"https"}]}}' \
  >/dev/null 2>&1 || true
log_success "Ingress Controller 설정 확인 완료"

# Step 10: Ingress 배포
start_spinner "Ingress 배포 중..."
# Ingress는 local 또는 prod 경로 확인
if [ -d "k8s/common/ingress/local" ]; then
    kubectl apply -f k8s/common/ingress/local/
elif [ -d "k8s/common/ingress/prod" ]; then
    # local이 없으면 prod 사용
    kubectl apply -f k8s/common/ingress/prod/
fi
stop_spinner "success" "Ingress 배포 완료"

# =============================================================================
# 4. 모니터링 스택 배포
# =============================================================================

log_section "모니터링 스택"

# Step 12: 모니터링 스택 배포
start_spinner "모니터링 스택 배포 중..."
kubectl apply -f k8s/infra/monitoring/common/ >/dev/null 2>&1
[ -d "k8s/infra/monitoring/local" ] && kubectl apply -f k8s/infra/monitoring/local/ >/dev/null 2>&1
stop_spinner "success" "모니터링 스택 매니페스트 적용 완료"

# Prometheus 대기
show_pod_status "${MONITORING_NAMESPACE}" "app=prometheus" 60 "Prometheus" || {
    log_warning "로그 확인: kubectl logs -l app=prometheus -n ${MONITORING_NAMESPACE}"
}

# Grafana 대기
show_pod_status "${MONITORING_NAMESPACE}" "app=grafana" 60 "Grafana" || {
    log_warning "로그 확인: kubectl logs -l app=grafana -n ${MONITORING_NAMESPACE}"
}

# Loki 대기
show_pod_status "${MONITORING_NAMESPACE}" "app=loki" 60 "Loki" || {
    log_warning "로그 확인: kubectl logs -l app=loki -n ${MONITORING_NAMESPACE}"
}

# =============================================================================
# 배포 상태 확인
# =============================================================================

# 제대로 안 뜬 Pod 일괄 삭제 후 재생성 (최종 대기 전)
start_spinner "비정상 Pod 정리 및 재생성 대기 전 확인 중..."
for NS in "${NAMESPACE}" "${KAFKA_NAMESPACE}" "${MONITORING_NAMESPACE}"; do
    if kubectl get namespace ${NS} &>/dev/null; then
        delete_unhealthy_replicasets "${NS}" ""
    fi
done
stop_spinner "success" "비정상 Pod 정리 완료"
sleep 2
echo ""

# Step 12: Pod 상태 최종 확인
TIMEOUT=60
ELAPSED=0
INTERVAL=3

while [ $ELAPSED -lt $TIMEOUT ]; do
    # 전체 Pod 개수
    TOTAL_PODS=$(kubectl get pods -n ${NAMESPACE} --no-headers 2>/dev/null | grep -vE "Completed|Succeeded" | wc -l | tr -d ' ')
    RUNNING_PODS=$(kubectl get pods -n ${NAMESPACE} --no-headers 2>/dev/null | grep "Running" | wc -l | tr -d ' ')
    READY_PODS=$(kubectl get pods -n ${NAMESPACE} --no-headers 2>/dev/null | awk '$2 ~ /^[0-9]+\/[0-9]+$/ {split($2,a,"/"); if(a[1]==a[2]) print}' | wc -l | tr -d ' ')
    
    if [ "$READY_PODS" -eq "$TOTAL_PODS" ] && [ "$TOTAL_PODS" -gt 0 ]; then
        printf "\r${CLEAR_LINE}${GREEN}✅${NC} 모든 Pod 준비 완료 (${READY_PODS}/${TOTAL_PODS})\n"
        break
    fi
    
    printf "\r${CLEAR_LINE}${CYAN}🔄${NC} Pod 상태: ${RUNNING_PODS} Running, ${READY_PODS}/${TOTAL_PODS} Ready (${ELAPSED}/${TIMEOUT}초)"
    
    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    echo ""
    echo -e "${YELLOW}⚠️  일부 Pod가 아직 준비되지 않았습니다.${NC}"
fi
echo ""

# 상태 확인
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}📊 배포 상태 확인${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# unbrdn 네임스페이스 상태
echo -e "${BOLD}=== unbrdn 네임스페이스 ===${NC}"
echo ""

# ReplicaSet 상태
echo -e "${CYAN}📦 ReplicaSet 상태:${NC}"
kubectl get replicaset -n ${NAMESPACE} -o wide 2>/dev/null || echo "  (ReplicaSet 없음)"
echo ""

# 정상 Pod
RUNNING_PODS=$(kubectl get pods -n ${NAMESPACE} --no-headers 2>/dev/null | grep "Running" | awk '$2 ~ /^[0-9]+\/[0-9]+$/ {split($2,a,"/"); if(a[1]==a[2]) print}' || true)
if [ -n "$RUNNING_PODS" ]; then
    echo -e "${GREEN}✅ 정상 작동 중인 Pod:${NC}"
    echo "$RUNNING_PODS" | awk '{printf "  %-40s %-15s %-10s %s\n", $1, $2, $3, $4}'
    echo ""
fi

# 시작 중인 Pod
STARTING_PODS=$(kubectl get pods -n ${NAMESPACE} --no-headers 2>/dev/null | grep -E "ContainerCreating|PodInitializing|Init:" || true)
if [ -n "$STARTING_PODS" ]; then
    echo -e "${CYAN}🔄 시작 중인 Pod:${NC}"
    echo "$STARTING_PODS" | awk '{printf "  %-40s %-15s %-10s %s\n", $1, $2, $3, $4}'
    echo ""
fi

# 문제가 있는 Pod
PROBLEMATIC_PODS=$(kubectl get pods -n ${NAMESPACE} --no-headers 2>/dev/null | grep -v "Running\|Completed\|ContainerCreating\|PodInitializing\|Init:" || true)
if [ -n "$PROBLEMATIC_PODS" ]; then
    echo -e "${YELLOW}⚠️  문제가 있는 Pod:${NC}"
    echo "$PROBLEMATIC_PODS" | awk '{printf "  %-40s %-15s %-10s %s\n", $1, $2, $3, $4}'
    echo ""
    echo -e "${CYAN}💡 문제 해결 방법:${NC}"
    echo "   1. Pod 로그: kubectl logs -f -n ${NAMESPACE} <pod-name>"
    echo "   2. Pod 상세: kubectl describe pod -n ${NAMESPACE} <pod-name>"
    echo "   3. 이벤트: kubectl get events -n ${NAMESPACE} --sort-by='.lastTimestamp'"
    echo ""
fi

# Kafka 네임스페이스 상태
echo -e "${BOLD}=== kafka 네임스페이스 ===${NC}"
echo ""

# Kafka Cluster 상태
KAFKA_STATUS=$(kubectl get kafka kafka-cluster -n ${KAFKA_NAMESPACE} -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
if [ "$KAFKA_STATUS" == "True" ]; then
    echo -e "${GREEN}✅ Kafka Cluster: Ready${NC}"
else
    echo -e "${YELLOW}⚠️  Kafka Cluster: Not Ready (Status: ${KAFKA_STATUS})${NC}"
fi
echo ""

# Kafka Pod 상태
KAFKA_RUNNING=$(kubectl get pods -n ${KAFKA_NAMESPACE} --no-headers 2>/dev/null | grep "Running" | wc -l | tr -d ' ')
KAFKA_TOTAL=$(kubectl get pods -n ${KAFKA_NAMESPACE} --no-headers 2>/dev/null | grep -vE "Completed|Succeeded" | wc -l | tr -d ' ')
echo -e "${CYAN}📦 Kafka Pods: ${KAFKA_RUNNING}/${KAFKA_TOTAL} Running${NC}"
kubectl get pods -n ${KAFKA_NAMESPACE} 2>/dev/null | head -10
echo ""

# Monitoring 네임스페이스 상태
echo -e "${BOLD}=== monitoring 네임스페이스 ===${NC}"
echo ""

# Monitoring Pod 상태
MONITORING_RUNNING=$(kubectl get pods -n ${MONITORING_NAMESPACE} --no-headers 2>/dev/null | grep "Running" | wc -l | tr -d ' ')
MONITORING_TOTAL=$(kubectl get pods -n ${MONITORING_NAMESPACE} --no-headers 2>/dev/null | grep -vE "Completed|Succeeded" | wc -l | tr -d ' ')
echo -e "${CYAN}📦 Monitoring Pods: ${MONITORING_RUNNING}/${MONITORING_TOTAL} Running${NC}"
kubectl get pods -n ${MONITORING_NAMESPACE} 2>/dev/null | head -10
echo ""

echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}✅ 로컬 환경 배포가 완료되었습니다!${NC}"
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}🔗 서비스 접속 정보${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}💡 Kind 클러스터는 포트 포워딩으로 접속합니다:${NC}"
echo ""
echo -e "  ${GREEN}•${NC} BFF (HTTP):       ${CYAN}http://localhost${NC}"
echo -e "  ${GREEN}•${NC} BFF (HTTPS):      ${CYAN}https://localhost${NC}"
echo -e "  ${GREEN}•${NC} Socket (HTTPS):   ${CYAN}https://localhost/socket.io${NC}"
echo ""
echo -e "  ${GREEN}•${NC} Kafka UI (HTTP):  ${CYAN}http://kafka.localhost${NC}"
echo -e "  ${GREEN}•${NC} Redis UI (HTTP):  ${CYAN}http://redis.localhost${NC}"
echo -e "  ${GREEN}•${NC} Grafana (HTTP):   ${CYAN}http://grafana.localhost${NC} ${DIM}(admin/admin)${NC}"
echo -e "  ${GREEN}•${NC} Prometheus:       ${CYAN}http://prometheus.localhost${NC}"
echo -e "  ${GREEN}•${NC} MinIO (Console):  ${CYAN}http://minio.localhost${NC}"
echo ""
echo -e "${YELLOW}⚠️  참고:${NC}"
echo -e "  - Kind는 포트 30080(HTTP), 30443(HTTPS)을 호스트의 80, 443으로 매핑합니다"
echo -e "  - 자체 서명 인증서이므로 브라우저에서 '안전하지 않음으로 이동'을 클릭하세요"
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}📝 유용한 명령어${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}상태 확인:${NC}"
echo "  kubectl get pods -n ${NAMESPACE}"
echo "  kubectl get pods -n ${KAFKA_NAMESPACE}"
echo "  kubectl get pods -n ${MONITORING_NAMESPACE}"
echo "  kubectl get kafka -n ${KAFKA_NAMESPACE}"
echo ""
echo -e "${CYAN}로그 확인:${NC}"
echo "  kubectl logs -f -n ${NAMESPACE} -l app=<service-name>"
echo "  kubectl logs -f -n ${NAMESPACE} deployment/<deployment-name>"
echo ""
echo -e "${CYAN}문제 해결:${NC}"
echo "  kubectl describe pod -n ${NAMESPACE} <pod-name>"
echo "  kubectl get events -n ${NAMESPACE} --sort-by='.lastTimestamp'"
echo ""
echo -e "${RED}${BOLD}전체 삭제:${NC}"
echo "  kubectl delete namespace ${NAMESPACE}"
echo "  kubectl delete namespace ${KAFKA_NAMESPACE}"
echo "  kubectl delete namespace ${MONITORING_NAMESPACE}"
echo ""
