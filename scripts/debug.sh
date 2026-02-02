#!/bin/bash

# 클러스터 디버깅 및 리소스 진단 스크립트 (통합)
# 사용법: 
#   ./scripts/debug.sh [NAMESPACE]              # Pod 진단
#   ./scripts/debug.sh [NAMESPACE] --resources # Pod + 리소스 진단

set -e

NAMESPACE=${1:-"unbrdn"}
SHOW_RESOURCES=false

# 옵션 파싱
if [ "$2" == "--resources" ] || [ "$2" == "-r" ]; then
    SHOW_RESOURCES=true
fi

echo "🔍 클러스터 진단을 시작합니다..."
echo "📁 네임스페이스: ${NAMESPACE}"
echo ""

# kubectl 설치 확인
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl이 설치되어 있지 않습니다."
    exit 1
fi

# =============================================================================
# 1. Pod 상태 확인
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Pod 상태 확인"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

kubectl get pods -n ${NAMESPACE}
echo ""

# =============================================================================
# 2. Core Pod 상세 정보
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚙️  Core Pod 상세 정보"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if kubectl get pod -l app=core -n ${NAMESPACE} 2>/dev/null | grep -q core; then
    CORE_PODS=($(kubectl get pod -l app=core -n ${NAMESPACE} -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || true))
    if [ ${#CORE_PODS[@]} -gt 0 ]; then
        for CORE_POD in "${CORE_PODS[@]}"; do
            echo "Pod 이름: ${CORE_POD}"
            echo ""
            echo "이벤트:"
            kubectl describe pod ${CORE_POD} -n ${NAMESPACE} 2>/dev/null | grep -A 10 "Events:" || echo "이벤트 없음"
            echo ""
            echo "이미지 정보:"
            kubectl get pod ${CORE_POD} -n ${NAMESPACE} -o jsonpath='{.spec.containers[0].image}' 2>/dev/null && echo "" || echo "정보 없음"
            echo ""
            echo "최근 로그 (마지막 20줄):"
            kubectl logs ${CORE_POD} -n ${NAMESPACE} --tail=20 2>/dev/null || echo "로그를 가져올 수 없습니다."
            echo ""
            echo "---"
            echo ""
        done
    else
        echo "⚠️  Core Pod를 찾을 수 없습니다."
    fi
else
    echo "⚠️  Core Pod를 찾을 수 없습니다."
fi
echo ""

# =============================================================================
# 3. Deployment 확인
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Deployment 확인"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

kubectl get deployment -n ${NAMESPACE} -o wide
echo ""

# =============================================================================
# 4. ConfigMap 및 Secret 확인
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 ConfigMap 및 Secret 확인"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Core ConfigMap:"
kubectl get configmap core-config -n ${NAMESPACE} 2>/dev/null && echo "✅ 존재함" || echo "❌ 없음"
echo ""

echo "이미지 Pull Secret:"
kubectl get secret ocir-secret -n ${NAMESPACE} 2>/dev/null && echo "✅ 존재함" || echo "❌ 없음"
echo ""

# =============================================================================
# 5. 리소스 진단 (옵션)
# =============================================================================
if [ "$SHOW_RESOURCES" = true ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📊 리소스 상태 확인"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # 1. 노드 리소스 할당량 확인
    echo "=== 노드 리소스 할당량 ==="
    kubectl get nodes -o custom-columns=NAME:.metadata.name,CPU-ALLOCATABLE:.status.allocatable.cpu,MEM-ALLOCATABLE:.status.allocatable.memory 2>/dev/null || echo "노드 정보를 가져올 수 없습니다."
    echo ""
    
    # 2. 노드별 리소스 요청량
    echo "=== 노드별 리소스 요청량 ==="
    for node in $(kubectl get nodes -o name 2>/dev/null | cut -d/ -f2); do
        echo "Node: $node"
        kubectl describe node $node 2>/dev/null | grep -A 5 "Allocated resources:" | grep -E "(cpu|memory)" | head -2 || echo "  정보 없음"
    done
    echo ""
    
    # 3. Pod별 리소스 요청/제한
    echo "=== Pod별 리소스 요청/제한 (${NAMESPACE}) ==="
    if command -v jq &> /dev/null; then
        kubectl get pods -n ${NAMESPACE} -o json 2>/dev/null | jq -r '.items[] | "\(.metadata.name): CPU req=\(.spec.containers[0].resources.requests.cpu // "none"), CPU lim=\(.spec.containers[0].resources.limits.cpu // "none"), MEM req=\(.spec.containers[0].resources.requests.memory // "none"), MEM lim=\(.spec.containers[0].resources.limits.memory // "none")"' || echo "Pod 정보를 가져올 수 없습니다."
    else
        kubectl get pods -n ${NAMESPACE} -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[0].resources.requests.cpu}{"\t"}{.spec.containers[0].resources.limits.cpu}{"\n"}{end}' 2>/dev/null | column -t || echo "Pod 정보를 가져올 수 없습니다."
    fi
    echo ""
    
    # 4. 현재 리소스 사용량 확인 (metrics-server가 있는 경우)
    echo "=== 현재 리소스 사용량 ==="
    if kubectl top nodes &>/dev/null; then
        kubectl top nodes
        echo ""
        kubectl top pods -n ${NAMESPACE} 2>/dev/null || echo "⚠️  Pod 사용량 정보를 가져올 수 없습니다 (metrics-server 확인 필요)"
    else
        echo "⚠️  metrics-server가 설치되지 않아 실제 사용량을 확인할 수 없습니다."
        echo "   노드별 할당량만 확인 가능합니다."
    fi
    echo ""
    
    # 5. 리소스 부족 문제 해결 방법
    echo "=== 리소스 부족 문제 해결 방법 ==="
    echo "💡 해결 방법:"
    echo "   1. 기존 Pod 중 일부를 축소 (예: Core Pod replicas 줄이기)"
    echo "   2. 리소스 요청량 조정 (Deployment 파일 수정)"
    echo ""
    echo "💡 수동으로 해결하려면:"
    echo "   Core Pod replicas 줄이기:"
    echo "   kubectl scale deployment core -n ${NAMESPACE} --replicas=1"
    echo ""
    echo "   또는 Deployment 파일에서 리소스 요청량 조정 후 재배포"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 진단 완료"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 사용법:"
echo "   - Pod 진단: ./scripts/debug.sh [NAMESPACE]"
echo "   - Pod + 리소스 진단: ./scripts/debug.sh [NAMESPACE] --resources"
echo ""
