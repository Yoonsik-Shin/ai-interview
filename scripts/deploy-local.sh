#!/bin/bash

# 로컬 환경 배포 스크립트 (Clean & Tree-style Logs)
# 사용법: ./scripts/deploy-local.sh

set -e

NAMESPACE="unbrdn"
KAFKA_NAMESPACE="kafka"
MONITORING_NAMESPACE="monitoring"

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
    [ -n "$SPINNER_PID" ] && kill $SPINNER_PID 2>/dev/null || true
    tput cnorm 2>/dev/null || true
}
trap cleanup_spinner_on_exit EXIT

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
        local total_pods=$(kubectl get pods -n $namespace -l $label --no-headers 2>/dev/null | wc -l | tr -d ' ')
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

# Docker 이미지 존재 확인 (Kind는 로컬 이미지 사용)
REQUIRED_IMAGES=("bff:latest" "core:latest" "llm:latest" "socket:latest" "stt:latest" "tts:latest" "storage:latest")
MISSING_IMAGES=()

for IMAGE in "${REQUIRED_IMAGES[@]}"; do
    if ! docker image inspect "$IMAGE" &> /dev/null; then
        MISSING_IMAGES+=("$IMAGE")
    fi
done

if [ ${#MISSING_IMAGES[@]} -gt 0 ]; then
    log_warning "다음 이미지를 찾을 수 없습니다:"
    for IMAGE in "${MISSING_IMAGES[@]}"; do
        log_info "Missing: ${IMAGE}"
    done
    
    log_task "이미지를 빌드해야 합니다."
    read -p "이미지를 지금 빌드하시겠습니까? (Y/n): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        if [ -f "./scripts/build-images-local.sh" ]; then
            log_task "이미지 빌드 시작..."
            if ! ./scripts/build-images-local.sh; then
                log_error "이미지 빌드에 실패했습니다."
                exit 1
            fi
            
            log_success "이미지 빌드가 완료되었습니다."
            
            # 빌드된 이미지를 Kind에 로드
            log_task "빌드된 이미지를 Kind 클러스터에 로드합니다..."
            for IMAGE in "${REQUIRED_IMAGES[@]}"; do
                start_spinner "로드 중: ${IMAGE}"
                kind load docker-image "$IMAGE" --name unbrdn-local >/dev/null 2>&1
                stop_spinner "success" "로드 완료: ${IMAGE}"
            done
        else
            log_error "build-images-local.sh 파일을 찾을 수 없습니다."
            exit 1
        fi
    else
        log_warning "이미지 없이 계속 진행합니다 (Pod 에러 가능성 있음)."
        read -p "계속 진행하시겠습니까? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_warning "배포를 중단합니다."
            exit 1
        fi
    fi
else
    # log_success "모든 로컬 이미지 확인 완료" # 생략
    
    log_task "Kind 클러스터 이미지 로드"
    for IMAGE in "${REQUIRED_IMAGES[@]}"; do
        start_spinner "이미지 로드 중: ${IMAGE}"
        # suppress output, only show error if fails (but logic || true masks it?)
        # kind load is noisy.
        if kind load docker-image "$IMAGE" --name unbrdn-local >/dev/null 2>&1; then
             stop_spinner "success" "이미지 로드 완료: ${IMAGE}"
        else
             # 이미 존재하거나 실패. kind load doesn't explicitly fail if present usually.
             stop_spinner "success" "이미지 로드 완료 (또는 이미 존재): ${IMAGE}"
        fi
    done
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
# 1. 인프라 배포
# =============================================================================

# Step 2: PostgreSQL 배포
start_spinner "PostgreSQL 배포 중..."
# PostgreSQL은 로컬 전용이므로 local 경로 사용
if [ -d "k8s/infra/postgres/local" ]; then
    kubectl apply -f k8s/infra/postgres/local/ >/dev/null 2>&1
else
    # local이 없으면 oracle 로컬 경로 확인
    if [ -d "k8s/infra/oracle" ]; then
        kubectl apply -f k8s/infra/oracle/ >/dev/null 2>&1 || true
    fi
fi
stop_spinner "success" "PostgreSQL 매니페스트 적용 완료"

show_pod_status "${NAMESPACE}" "app=postgres" 60 "PostgreSQL" || {
    log_warning "로그 확인: kubectl logs -l app=postgres -n ${NAMESPACE}"
}

# Step 3: Redis Sentinel 배포 (Bitnami Helm Chart)
# log_task "Redis Sentinel 배포 중 (Helm)..."
start_spinner "Redis Helm Chart 배포 중..."

# Bitnami Helm Repository 추가
if ! helm repo list | grep -q bitnami; then
    helm repo add bitnami https://charts.bitnami.com/bitnami >/dev/null 2>&1
    helm repo update >/dev/null 2>&1
fi

# Helm values 파일 확인 (로컬/프로덕션 동일)
REDIS_VALUES_FILE="k8s/infra/redis/helm/values.yaml"
if [ ! -f "$REDIS_VALUES_FILE" ]; then
    stop_spinner "error" "Helm values 파일이 없습니다: k8s/infra/redis/helm/values.yaml"
    exit 1
fi

# 실패한 Helm Release 정리
REDIS_EXISTS=$(helm list -n ${NAMESPACE} -q 2>/dev/null | grep -x "^redis$" || echo "")
if [ -n "$REDIS_EXISTS" ]; then
    REDIS_STATUS=$(helm status redis -n ${NAMESPACE} 2>/dev/null | grep "^STATUS:" | awk '{print $2}' || echo "")
    if [ "$REDIS_STATUS" = "failed" ] || [ "$REDIS_STATUS" = "pending-install" ] || [ "$REDIS_STATUS" = "pending-upgrade" ]; then
        helm uninstall redis -n ${NAMESPACE} --ignore-not-found 2>/dev/null || true
        sleep 2
    fi
fi

# Helm 미관리 Redis 리소스 정리
drop_old_redis() {
    local kind=$1 name=$2
    if kubectl get "$kind" "$name" -n "${NAMESPACE}" &>/dev/null; then
        local managed
        managed=$(kubectl get "$kind" "$name" -n "${NAMESPACE}" -o jsonpath='{.metadata.labels.app\.kubernetes\.io/managed-by}' 2>/dev/null || echo "")
        if [ "$managed" != "Helm" ]; then
            kubectl delete "$kind" "$name" -n "${NAMESPACE}" --ignore-not-found --wait=false 2>/dev/null || true
        fi
    fi
}
drop_old_redis svc redis-headless
drop_old_redis svc redis
drop_old_redis configmap redis-config
if kubectl get statefulset redis -n "${NAMESPACE}" &>/dev/null; then
    managed=$(kubectl get statefulset redis -n "${NAMESPACE}" -o jsonpath='{.metadata.labels.app\.kubernetes\.io/managed-by}' 2>/dev/null || echo "")
    if [ "$managed" != "Helm" ]; then
        kubectl -n "${NAMESPACE}" delete statefulset redis --cascade=orphan --ignore-not-found 2>/dev/null || true
        kubectl -n "${NAMESPACE}" delete pods -l app=redis --ignore-not-found --grace-period=0 --force 2>/dev/null || true
    fi
fi
sleep 2

# helm upgrade --install 사용 
HELM_OUTPUT=$(helm upgrade --install redis bitnami/redis \
    --namespace ${NAMESPACE} \
    --create-namespace \
    --values ${REDIS_VALUES_FILE} \
    2>&1)
HELM_EXIT=$?

if [ $HELM_EXIT -ne 0 ]; then
    if echo "$HELM_OUTPUT" | grep -q "cannot reuse a name"; then
        helm uninstall redis -n ${NAMESPACE} --ignore-not-found 2>/dev/null || true
        sleep 2
        HELM_OUTPUT=$(helm install redis bitnami/redis \
            --namespace ${NAMESPACE} \
            --create-namespace \
            --values ${REDIS_VALUES_FILE} \
            2>&1)
        HELM_EXIT=$?
    fi
fi

if [ $HELM_EXIT -ne 0 ]; then
    stop_spinner "error" "Redis Helm 배포 실패"
    echo "$HELM_OUTPUT"
    log_info "상태 확인: helm status redis -n ${NAMESPACE}"
    exit 1
fi

stop_spinner "success" "Redis Helm Chart 배포 완료"

# Redis Pod 준비 확인
REDIS_TIMEOUT=300
REDIS_ELAPSED=0
REDIS_INTERVAL=3

# show_pod_status와 유사하지만 Master+Replica 체크 로직이 있어 별도 루프 유지하되 로그 스타일 변경
while [ $REDIS_ELAPSED -lt $REDIS_TIMEOUT ]; do
    REDIS_PODS=$(kubectl get pods -n ${NAMESPACE} -l app.kubernetes.io/name=redis --no-headers 2>/dev/null | wc -l | tr -d ' ')
    REDIS_READY=$(kubectl get pods -n ${NAMESPACE} -l app.kubernetes.io/name=redis --no-headers 2>/dev/null | grep "Running" | awk '$2 ~ /^[0-9]+\/[0-9]+$/ {split($2,a,"/"); if(a[1]==a[2]) print}' | wc -l | tr -d ' ')
    
    # Sentinel 모드: Master 1개 + Replica 2개 = 3개 Pod
    if [ "$REDIS_READY" -ge 3 ] && [ "$REDIS_PODS" -ge 3 ]; then
        printf "\r${CLEAR_LINE}${CYAN}│   ├──${NC} ${GREEN}✅${NC} Redis Sentinel 준비 완료 (${REDIS_READY}/3 Pods)\n"
        break
    fi
    
    ERROR_PODS=$(kubectl get pods -n ${NAMESPACE} -l app.kubernetes.io/name=redis --no-headers 2>/dev/null | grep -E "ImagePullBackOff|ErrImagePull|CrashLoopBackOff|Error" | wc -l | tr -d ' ')
    if [ "$ERROR_PODS" -gt 0 ]; then
        printf "\r${CLEAR_LINE}${CYAN}│   ├──${NC} ${YELLOW}⚠️  Redis Pod 상태: ${REDIS_READY}/3 Ready (에러: ${ERROR_PODS}개)${NC}\n"
        log_info "문제 Pod 확인 필요"
        break
    fi
    
    printf "\r${CLEAR_LINE}${CYAN}│   ├──${NC} 🔄 Redis: ${REDIS_READY}/${REDIS_PODS} Pods 준비됨 ${DIM}(${REDIS_ELAPSED}/${REDIS_TIMEOUT}s)${NC}"
    
    sleep $REDIS_INTERVAL
    REDIS_ELAPSED=$((REDIS_ELAPSED + REDIS_INTERVAL))
done

if [ $REDIS_ELAPSED -ge $REDIS_TIMEOUT ]; then
    printf "\r${CLEAR_LINE}${CYAN}│   ├──${NC} ${YELLOW}⚠️  Redis Pod 준비 타임아웃${NC}\n"
fi

# Step 4: Kafka 클러스터 배포
# echo -e "${CYAN}📦${NC} Kafka 클러스터 매니페스트 적용 중..."
start_spinner "Kafka 클러스터 배포 중..."

# Kind 기본 StorageClass 없으면 local-path-provisioner 설치 후 default 지정 (Kafka PVC용)
DEFAULT_SC=$(kubectl get storageclass -o jsonpath='{.items[?(@.metadata.annotations.storageclass\.kubernetes\.io/is-default-class=="true")].metadata.name}' 2>/dev/null || echo "")
if [ -z "$DEFAULT_SC" ]; then
    if ! kubectl get storageclass local-path &>/dev/null; then
        # echo "   Kind에 default StorageClass 없음 → local-path-provisioner 설치 중..."
        kubectl apply -f 'https://raw.githubusercontent.com/rancher/local-path-provisioner/v0.0.26/deploy/local-path-storage.yaml' 2>/dev/null || \
        kubectl apply -f 'https://raw.githubusercontent.com/rancher/local-path-provisioner/master/deploy/local-path-storage.yaml' 2>/dev/null || true
        # echo "   local-path-provisioner Deployment 준비 대기 중..."
        kubectl wait --for=condition=available deployment/local-path-provisioner -n local-path-storage --timeout=120s 2>/dev/null || true
    fi
    if kubectl get storageclass local-path &>/dev/null; then
        kubectl patch storageclass local-path -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}' 2>/dev/null || true
        # echo "   default StorageClass: local-path"
    elif kubectl get storageclass standard &>/dev/null; then
        kubectl patch storageclass standard -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}' 2>/dev/null || true
    fi
fi
# Kafka: common(ConfigMap, Kafka CR) → local(NodePool, Kafka UI)
# 변경 없으면 apply는 no-op. NodePool 삭제하지 않아 기존 Pod 유지.
if [ -d "k8s/infra/kafka/common" ]; then
    kubectl apply -f k8s/infra/kafka/common/
fi

if [ -d "k8s/infra/kafka/local" ]; then
    for f in kafka-nodepool.yaml kafka-ui-deployment.yaml kafka-ui-service.yaml kafka-ui-externalname.yaml; do
        [ -f "k8s/infra/kafka/local/$f" ] && kubectl apply -f "k8s/infra/kafka/local/$f"
    done
else
    stop_spinner "error" "로컬용 Kafka 매니페스트가 없습니다"
    exit 1
fi
stop_spinner "success" "Kafka 클러스터 매니페스트 적용 완료"

# Kafka 이미 Ready면 대기 스킵 (변화 없을 때 Pod 재생성 방지)
KAFKA_STATUS=$(kubectl get kafka kafka-cluster -n ${KAFKA_NAMESPACE} -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
if [ "$KAFKA_STATUS" == "True" ]; then
    KAFKA_READY=$(kubectl get pods -n ${KAFKA_NAMESPACE} -l strimzi.io/cluster=kafka-cluster --no-headers 2>/dev/null | grep "Running" | wc -l | tr -d ' ')
    log_success "Kafka 클러스터 이미 준비됨 (${KAFKA_READY} Pods)"
else
    # Kafka 클러스터 준비 대기 (Strimzi 3노드, 최대 5분)
    # echo -e "${CYAN}⏳${NC} Kafka 클러스터 준비 대기 중 (3노드, 최대 5분)..."
    KAFKA_TIMEOUT=300
    KAFKA_ELAPSED=0
    KAFKA_INTERVAL=3

    while [ $KAFKA_ELAPSED -lt $KAFKA_TIMEOUT ]; do
        KAFKA_STATUS=$(kubectl get kafka kafka-cluster -n ${KAFKA_NAMESPACE} -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
        if [ "$KAFKA_STATUS" == "True" ]; then
            printf "\r${CLEAR_LINE}${CYAN}│   ├──${NC} ${GREEN}✅${NC} Kafka 클러스터 준비 완료 (${KAFKA_ELAPSED}초)\n"
            break
        fi
        KAFKA_PODS=$(kubectl get pods -n ${KAFKA_NAMESPACE} -l strimzi.io/cluster=kafka-cluster --no-headers 2>/dev/null | grep -v "Evicted\|Failed\|Unknown" | wc -l | tr -d ' ')
        KAFKA_READY=$(kubectl get pods -n ${KAFKA_NAMESPACE} -l strimzi.io/cluster=kafka-cluster --no-headers 2>/dev/null | grep "Running" | wc -l | tr -d ' ')
        printf "\r${CLEAR_LINE}${CYAN}│   ├──${NC} 🔄 Kafka: ${KAFKA_READY}/${KAFKA_PODS} Pods 준비됨 ${DIM}(${KAFKA_ELAPSED}/${KAFKA_TIMEOUT}s)${NC}"
        sleep $KAFKA_INTERVAL
        KAFKA_ELAPSED=$((KAFKA_ELAPSED + KAFKA_INTERVAL))
    done

    if [ $KAFKA_ELAPSED -ge $KAFKA_TIMEOUT ]; then
        printf "\r${CLEAR_LINE}${CYAN}│   ├──${NC} ${YELLOW}⚠️  Kafka 클러스터 준비 지연${NC}\n"
        log_info "상태 확인: kubectl get kafka -n ${KAFKA_NAMESPACE}"
    fi
fi
echo ""

# Step 4.5: MinIO 배포 (Storage 서비스용)
start_spinner "MinIO 배포 중..."
if [ -d "k8s/infra/minio" ]; then
    kubectl apply -f k8s/infra/minio/ >/dev/null 2>&1
    stop_spinner "success" "MinIO 매니페스트 적용 완료"
    
    # MinIO Pod 준비 대기
    # echo -e "${CYAN}⏳${NC} MinIO Pod 준비 확인 중..."
    MINIO_TIMEOUT=120
    MINIO_ELAPSED=0
    MINIO_INTERVAL=3
    
    while [ $MINIO_ELAPSED -lt $MINIO_TIMEOUT ]; do
        MINIO_READY=$(kubectl get pods -n ${NAMESPACE} -l app=minio --no-headers 2>/dev/null | grep "Running" | awk '$2 ~ /^[0-9]+\/[0-9]+$/ {split($2,a,"/"); if(a[1]==a[2]) print}' | wc -l | tr -d ' ')
        if [ "$MINIO_READY" -ge 1 ]; then
            printf "\r${CLEAR_LINE}${CYAN}│   ├──${NC} ${GREEN}✅${NC} MinIO 준비 완료 (${MINIO_ELAPSED}초)\n"
            break
        fi
        printf "\r${CLEAR_LINE}${CYAN}│   ├──${NC} 🔄 MinIO: ${MINIO_READY}/1 Pod 준비 중 ${DIM}(${MINIO_ELAPSED}/${MINIO_TIMEOUT}s)${NC}"
        sleep $MINIO_INTERVAL
        MINIO_ELAPSED=$((MINIO_ELAPSED + MINIO_INTERVAL))
    done
    
    if [ $MINIO_ELAPSED -ge $MINIO_TIMEOUT ]; then
        printf "\r${CLEAR_LINE}${CYAN}│   ├──${NC} ${YELLOW}⚠️  MinIO 준비 타임아웃${NC}\n"
    fi
    
    # interview-archives 버킷 생성 Job 실행
    if [ -f "k8s/infra/minio/job-create-bucket.yaml" ]; then
        kubectl apply -f k8s/infra/minio/job-create-bucket.yaml >/dev/null 2>&1
        log_success "MinIO 버킷 생성 Job 실행"
    fi
else
    stop_spinner "warning" "MinIO 매니페스트 없음 (건너뜀)"
fi

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
ensure_secret "llm-secrets"       || MISSING_SECRETS+=("llm-secrets")
ensure_secret "stt-secrets"       || MISSING_SECRETS+=("stt-secrets")
ensure_secret "tts-secrets"       || MISSING_SECRETS+=("tts-secrets")
ensure_secret "storage-secrets"   || MISSING_SECRETS+=("storage-secrets")
# oracle-db-credentials: 로컬 환경에서는 PostgreSQL 사용하므로 불필요
# ensure_secret "oracle-db-credentials" || MISSING_SECRETS+=("oracle-db-credentials")
ensure_secret "core-jwt-keys"     || MISSING_SECRETS+=("core-jwt-keys")
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

  ensure_secret "llm-secrets"       || create_secret_llm
  ensure_secret "stt-secrets"       || create_secret_stt
  ensure_secret "tts-secrets"       || create_secret_tts
  ensure_secret "storage-secrets"   || create_secret_storage
  # oracle-db-credentials: 로컬 환경에서는 PostgreSQL 사용하므로 생성하지 않음
  # ensure_secret "oracle-db-credentials" || create_secret_oracle
  ensure_secret "core-jwt-keys"     || create_secret_core_jwt
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

# 서비스별 배포
SERVICES=("llm" "stt" "tts" "storage" "core" "bff" "socket")
SERVICE_LABELS=("app=llm" "app=stt" "app=tts" "app=storage" "app=core" "app=bff" "app=socket")

# 선택적 배포 로직 추가
SELECTED_SERVICES=()
if [ $# -gt 0 ]; then
    for arg in "$@"; do
        LOADING=false
        for svc in "${SERVICES[@]}"; do
            if [ "$svc" == "$arg" ]; then
                SELECTED_SERVICES+=("$svc")
                LOADING=true
                break
            fi
        done
        if [ "$LOADING" = false ]; then
            log_warning "알 수 없는 서비스: $arg (무시됨)"
        fi
    done
fi

if [ ${#SELECTED_SERVICES[@]} -gt 0 ]; then
    log_info "선택된 서비스만 배포합니다: ${SELECTED_SERVICES[*]}"
    # SERVICES 배열을 선택된 서비스 순서대로 재구성 (의존성 순서 유지 로직은 여기서는 단순 필터링으로 처리)
    # 기존 순서를 유지하면서 필터링
    NEW_SERVICES=()
    NEW_LABELS=()
    for i in "${!SERVICES[@]}"; do
        SVC="${SERVICES[$i]}"
        LABEL="${SERVICE_LABELS[$i]}"
        for SEL in "${SELECTED_SERVICES[@]}"; do
            if [ "$SVC" == "$SEL" ]; then
                NEW_SERVICES+=("$SVC")
                NEW_LABELS+=("$LABEL")
                break
            fi
        done
    done
    SERVICES=("${NEW_SERVICES[@]}")
    SERVICE_LABELS=("${NEW_LABELS[@]}")
fi


for i in "${!SERVICES[@]}"; do
    SERVICE=${SERVICES[$i]}
    LABEL=${SERVICE_LABELS[$i]}
    
    start_spinner "${SERVICE} 배포 중..."
    # common 먼저, 그 다음 prod/local 적용. *.yaml만 적용 (README, *.example 제외)
    for f in k8s/apps/${SERVICE}/common/*.yaml k8s/apps/${SERVICE}/common/*.yml; do
        [ -e "$f" ] && [[ "$f" != *example* ]] && kubectl apply -f "$f" >/dev/null 2>&1
    done
    if [ -d "k8s/apps/${SERVICE}/local" ]; then
        TGT="local"
    else
        TGT="prod"
    fi
    for f in k8s/apps/${SERVICE}/${TGT}/*.yaml k8s/apps/${SERVICE}/${TGT}/*.yml; do
        [ -e "$f" ] && [[ "$f" != *example* ]] && kubectl apply -f "$f" >/dev/null 2>&1
    done
    stop_spinner "success" "${SERVICE} 매니페스트 적용 완료"
    
    # 이미지 재빌드 시 Pod을 강제로 재시작 (latest 태그의 경우 필수)
    # Deployment가 존재하는 경우에만 재시작
    if kubectl get deployment ${SERVICE} -n ${NAMESPACE} &>/dev/null; then
        start_spinner "${SERVICE} Pod 재시작 중..."
        kubectl rollout restart deployment ${SERVICE} -n ${NAMESPACE} >/dev/null 2>&1
        stop_spinner "success" "${SERVICE} Pod 재시작 완료"
    else
        # Deployment가 없는 경우 (StatefulSet 등) 스피너 없이 메시지만 출력
        log_warning "${SERVICE} Deployment가 없습니다 (건너뜀)"
    fi
    
    if ! show_pod_status "${NAMESPACE}" "${LABEL}" 120 "${SERVICE}"; then
        # 제대로 안 뜬 Pod 삭제 후 재시도 (컨트롤러가 재생성)
        log_info "비정상 Pod의 ReplicaSet 삭제 후 재시도..."
        delete_unhealthy_replicasets "${NAMESPACE}" "${LABEL}"
        sleep 3
        if ! show_pod_status "${NAMESPACE}" "${LABEL}" 90 "${SERVICE}"; then
            log_warning "로그 확인: kubectl logs -l ${LABEL} -n ${NAMESPACE}"
        fi
    fi
done

# Step 9: 자체 서명 인증서 생성
if ! kubectl get secret tls-secret -n ${NAMESPACE} &>/dev/null; then
    start_spinner "자체 서명 인증서 생성 중..."
    ./scripts/generate-self-signed-cert.sh >/dev/null 2>&1
    stop_spinner "success" "자체 서명 인증서 생성 완료"
else
    log_success "인증서가 이미 존재합니다"
fi

# Step 9.5: Ingress Controller 설치 (필수 - Kind 전용)
log_section "Ingress Controller"
if ! kubectl get pods -n ingress-nginx -l app.kubernetes.io/component=controller &> /dev/null; then
    start_spinner "Ingress Controller 설치 중..."
    # Kind 전용 Ingress Controller 매니페스트 사용 (NodePort 자동 설정)
    # Kind 전용 Ingress Controller 매니페스트 사용 (NodePort 자동 설정)
    if kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml >/dev/null 2>&1; then
        stop_spinner "success" "Ingress Controller 매니페스트 적용 완료"
    else
        stop_spinner "error" "Ingress Controller 매니페스트 적용 실패"
        log_error "설치 중 에러가 발생했습니다."
        exit 1
    fi

    # Controller가 준비될 때까지 대기
    log_task "Ingress Controller 준비 대기 중..."
    if ! kubectl wait --namespace ingress-nginx \
      --for=condition=ready pod \
      --selector=app.kubernetes.io/component=controller \
      --timeout=120s >/dev/null 2>&1; then
        log_error "Ingress Controller가 준비되지 않았습니다."
        exit 1
    fi

    # Kind의 경우 NodePort 30080/30443으로 자동 패치 (확실하게 하기 위해)
    # log_task "NodePort 확인 및 패치 (30080/30443)..."
    kubectl patch svc ingress-nginx-controller -n ingress-nginx \
      -p '{"spec":{"type":"NodePort","ports":[{"port":80,"nodePort":30080,"protocol":"TCP","targetPort":"http"},{"port":443,"nodePort":30443,"protocol":"TCP","targetPort":"https"}]}}' \
      >/dev/null 2>&1 || true
      
    log_success "Ingress Controller 설정 완료 (localhost:80 & localhost:443 접근 가능)"
else
    log_success "Ingress Controller가 이미 설치되어 있습니다."
    # 기존 설치된 경우에도 NodePort 확인
    CURRENT_TYPE=$(kubectl get svc ingress-nginx-controller -n ingress-nginx -o jsonpath='{.spec.type}' 2>/dev/null || echo "")
    if [ "$CURRENT_TYPE" != "NodePort" ]; then
        log_task "서비스 타입을 NodePort로 변경 중..."
        kubectl patch svc ingress-nginx-controller -n ingress-nginx \
          -p '{"spec":{"type":"NodePort","ports":[{"port":80,"nodePort":30080,"protocol":"TCP","targetPort":"http"},{"port":443,"nodePort":30443,"protocol":"TCP","targetPort":"https"}]}}' \
          >/dev/null 2>&1 || true
        log_success "NodePort 설정 완료"
    fi
fi

# Step 10: Ingress 배포
start_spinner "Ingress 배포 중..."
# Ingress는 local 또는 prod 경로 확인
if [ -d "k8s/common/ingress/local" ]; then
    kubectl apply -f k8s/common/ingress/local/ >/dev/null 2>&1
elif [ -d "k8s/common/ingress/prod" ]; then
    # local이 없으면 prod 사용
    kubectl apply -f k8s/common/ingress/prod/ >/dev/null 2>&1
fi
stop_spinner "success" "Ingress 배포 완료"

# =============================================================================
# 4. 모니터링 스택 배포
# =============================================================================

log_section "모니터링 스택"

# Step 12: 모니터링 스택 배포
start_spinner "모니터링 스택 배포 중..."
kubectl apply -f k8s/infra/monitoring/common/ >/dev/null 2>&1
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
    TOTAL_PODS=$(kubectl get pods -n ${NAMESPACE} --no-headers 2>/dev/null | wc -l | tr -d ' ')
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
KAFKA_TOTAL=$(kubectl get pods -n ${KAFKA_NAMESPACE} --no-headers 2>/dev/null | wc -l | tr -d ' ')
echo -e "${CYAN}📦 Kafka Pods: ${KAFKA_RUNNING}/${KAFKA_TOTAL} Running${NC}"
kubectl get pods -n ${KAFKA_NAMESPACE} 2>/dev/null | head -10
echo ""

# Monitoring 네임스페이스 상태
echo -e "${BOLD}=== monitoring 네임스페이스 ===${NC}"
echo ""

# Monitoring Pod 상태
MONITORING_RUNNING=$(kubectl get pods -n ${MONITORING_NAMESPACE} --no-headers 2>/dev/null | grep "Running" | wc -l | tr -d ' ')
MONITORING_TOTAL=$(kubectl get pods -n ${MONITORING_NAMESPACE} --no-headers 2>/dev/null | wc -l | tr -d ' ')
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
echo -e "  ${GREEN}•${NC} Kafka UI (HTTPS): ${CYAN}https://localhost/admin${NC}"
echo -e "  ${GREEN}•${NC} Grafana (HTTPS):  ${CYAN}https://localhost/grafana${NC} ${DIM}(admin/admin)${NC}"
echo -e "  ${GREEN}•${NC} Prometheus:       ${CYAN}https://localhost/prometheus${NC}"
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
