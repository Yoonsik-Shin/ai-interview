#!/bin/bash
# Kind 멀티 노드 클러스터 시작 스크립트
# 로컬: 2 vCPU 8GB × 3 워커 (Control Plane + Worker 3)

set -e

CLUSTER_NAME="unbrdn-local"
CONFIG_FILE="k8s/kind-cluster-config.yaml"

KUBELET_DEBUG_LOG="/tmp/kubelet-debug-${CLUSTER_NAME}.log"

# kind 생성 중 control-plane이 있는 동안 주기적으로 kubelet 로그 수집 (실패 시 Kind가 노드 삭제하여 사후 수집 불가)
start_kubelet_log_collector() {
    : > "$KUBELET_DEBUG_LOG"
    (
        until docker ps -a --filter "name=${CLUSTER_NAME}-control-plane" --format "{{.ID}}" | grep -q .; do
            sleep 3
        done
        CP=$(docker ps -a --filter "name=${CLUSTER_NAME}-control-plane" --format "{{.ID}}" | head -1)
        [ -z "$CP" ] && return
        while docker ps -a --no-trunc 2>/dev/null | grep -q "$CP"; do
            {
                echo "===== $(date -u +%Y-%m-%dT%H:%M:%SZ) ====="
                docker exec "$CP" systemctl status kubelet --no-pager 2>/dev/null || true
                docker exec "$CP" journalctl -u kubelet --no-pager -n 80 2>/dev/null || true
                docker exec "$CP" systemctl status containerd --no-pager 2>/dev/null || true
                echo ""
            } >> "$KUBELET_DEBUG_LOG" 2>&1
            sleep 15
        done
    ) &
    KUBELET_LOG_PID=$!
}

stop_kubelet_log_collector() {
    [ -n "$KUBELET_LOG_PID" ] && kill "$KUBELET_LOG_PID" 2>/dev/null || true
    wait "$KUBELET_LOG_PID" 2>/dev/null || true
}

collect_kubelet_logs() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔍 kubelet 로그 (생성 중 수집분, 근본 원인 파악용)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if [ -s "$KUBELET_DEBUG_LOG" ]; then
        cat "$KUBELET_DEBUG_LOG"
    else
        echo "(수집된 로그 없음. control-plane이 너무 빨리 삭제되었을 수 있음.)"
    fi
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

echo "🚀 Kind 멀티 노드 클러스터 설정 시작..."

# Kind 설치 여부 확인
if ! command -v kind &> /dev/null; then
    echo "❌ Kind가 설치되지 않았습니다."
    echo "📦 Kind 설치 방법:"
    echo "   macOS: brew install kind"
    echo "   Linux: curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64 && chmod +x ./kind && sudo mv ./kind /usr/local/bin/"
    exit 1
fi

# 기존 클러스터 삭제 (있을 경우)
if kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
    echo "⚠️  기존 클러스터 발견. 삭제 중..."
    kind delete cluster --name ${CLUSTER_NAME}
fi

# Kind 클러스터 생성
K8S_VERSION="v1.35.0"
KIND_IMAGE="kindest/node:${K8S_VERSION}"
echo "🔧 Kind 클러스터 생성 중 (4-Node: Control Plane + Worker 3, 2 vCPU 8GB×3)..."
echo "   Kubernetes 버전: ${K8S_VERSION}"
echo "   (2 vCPU 8GB × 3 워커 - Kafka/Redis 분산, HA 테스트)"

# 클러스터 생성 시도 (실패 시 생성 중 수집한 kubelet 로그 출력)
start_kubelet_log_collector
KIND_EXIT=0
kind create cluster --name ${CLUSTER_NAME} --config ${CONFIG_FILE} --image ${KIND_IMAGE} 2>&1 || KIND_EXIT=$?
stop_kubelet_log_collector

if [ "$KIND_EXIT" -ne 0 ]; then
    echo ""
    echo "❌ 클러스터 생성 실패. kubelet 로그를 출력합니다..."
    collect_kubelet_logs
    echo ""
    echo "💡 문제 해결 방법:"
    echo "   1. Docker Desktop 리소스 확인 (메모리 4GB+, CPU 2+ 권장)"
    echo "   2. Docker Desktop 재시작"
    echo "   3. 노드 수 줄이기 (k8s/kind-cluster-config.yaml에서 worker 노드 일부 제거)"
    exit 1
fi

# API 서버 연결 가능할 때까지 대기 (Kind 생성 직후 일시적으로 connection refused 발생 가능)
echo "🔎 API 서버 연결 대기 중..."
API_WAIT=90
api_elapsed=0
while [ $api_elapsed -lt $API_WAIT ]; do
    if kubectl cluster-info &>/dev/null; then
        echo "✅ API 서버 연결됨 (${api_elapsed}초)"
        break
    fi
    sleep 3
    api_elapsed=$((api_elapsed + 3))
done
if [ $api_elapsed -ge $API_WAIT ]; then
    echo "❌ API 서버 연결 타임아웃 (${API_WAIT}초). docker ps | grep unbrdn-local 로 컨테이너 상태를 확인하세요."
    exit 1
fi

# 노드 구성 확인 (config에 정의된 worker 개수 파악)
WORKER_COUNT=$(grep -E '^\s*-\s*role:\s*worker' "${CONFIG_FILE}" | wc -l | tr -d ' ')
CONTROL_COUNT=$(grep -E '^\s*-\s*role:\s*control-plane' "${CONFIG_FILE}" | wc -l | tr -d ' ')
EXPECTED_NODES=$((WORKER_COUNT + CONTROL_COUNT))

# 노드 준비 대기
echo "🔎 기대 노드 수: ${EXPECTED_NODES} (worker:${WORKER_COUNT} control:${CONTROL_COUNT}) - 노드 준비 대기 중..."
READY_WAIT=120
elapsed=0
NODE_COUNT=0
until [ "$elapsed" -ge "$READY_WAIT" ]; do
    NODE_COUNT=$(kubectl get nodes --no-headers 2>/dev/null | wc -l | tr -d ' ')
    if [ "$NODE_COUNT" -ge "$EXPECTED_NODES" ]; then
        echo "✅ 노드가 모두 생성되었습니다: ${NODE_COUNT}/${EXPECTED_NODES}"
        break
    fi
    sleep 2
    elapsed=$((elapsed + 2))
done
if [ "${NODE_COUNT:-0}" -lt "$EXPECTED_NODES" ]; then
    echo "⚠️  노드가 예상 수보다 적습니다: ${NODE_COUNT:-0}/${EXPECTED_NODES}. 확인 필요."
fi

# 노드가 Ready 상태가 될 때까지 대기 (CNI 초기화 등)
echo "⏳ 노드 Ready 상태 대기 중 (최대 120초)..."
READY_STATE_WAIT=120
ready_elapsed=0
READY_COUNT=0
until [ "$ready_elapsed" -ge "$READY_STATE_WAIT" ]; do
    READY_COUNT=$(kubectl get nodes --no-headers 2>/dev/null | grep -c " Ready " || echo "0")
    # 숫자만 추출 (공백/개행 제거)
    READY_COUNT=$(echo "$READY_COUNT" | tr -d '[:space:]' | grep -E '^[0-9]+$' || echo "0")
    if [ "$READY_COUNT" -ge "$EXPECTED_NODES" ]; then
        echo "✅ 모든 노드가 Ready 상태입니다: ${READY_COUNT}/${EXPECTED_NODES} (${ready_elapsed}초)"
        break
    fi
    if [ $((ready_elapsed % 10)) -eq 0 ] && [ "$ready_elapsed" -gt 0 ]; then
        echo "   ⏳ Ready: ${READY_COUNT}/${EXPECTED_NODES} (${ready_elapsed}초 경과)..."
    fi
    sleep 2
    ready_elapsed=$((ready_elapsed + 2))
done
if [ "${READY_COUNT:-0}" -lt "$EXPECTED_NODES" ]; then
    echo "⚠️  일부 노드가 아직 Ready 상태가 아닙니다: ${READY_COUNT:-0}/${EXPECTED_NODES}. CNI 초기화 중일 수 있습니다."
    echo "   몇 초 후 'kubectl get nodes'로 다시 확인하세요."
fi

# 2 vCPU 8GB × 3 워커: Preemptible 미사용. 3 워커 모두 main으로 동일 스케줄링.

# Node Pool 라벨 확인
echo "📋 노드 목록 및 라벨 확인:"
kubectl get nodes --show-labels | grep -E "node-pool|NAME"

echo ""
echo "✅ Kind 클러스터 준비 완료!"
echo ""
echo "📌 다음 단계:"
echo "   1. Strimzi Operator 설치: ./scripts/setup-strimzi-local.sh"
echo "   2. 애플리케이션 배포: ./scripts/deploy-local.sh"
echo ""
echo "🔍 노드 상태 확인:"
kubectl get nodes -o wide
echo ""
# Post-creation: add common role label to control-plane node (avoid injecting via kubelet flags)
echo "🔧 control-plane에 표준 role 레이블 추가: node-role.kubernetes.io/control-plane="
kubectl label node "${CLUSTER_NAME}-control-plane" node-role.kubernetes.io/control-plane="" --overwrite || true
kubectl label node "${CLUSTER_NAME}-control-plane" ingress-ready=true --overwrite || true
kubectl get nodes --show-labels | grep -E "node-pool|NAME"
echo ""
echo "🎯 장애 시뮬레이션 방법:"
echo "   # 워커 노드 1대 중지 (2 vCPU 8GB × 3 중 1대)"
echo "   docker stop ${CLUSTER_NAME}-worker"
echo ""
echo "   # 노드 복구"
echo "   docker start ${CLUSTER_NAME}-worker"
