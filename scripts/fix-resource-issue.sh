#!/bin/bash

# 리소스 요약 및 문제 해결 스크립트
# 사용법: ./scripts/fix-resource-issue.sh [NAMESPACE]

set -e

NAMESPACE=${1:-"unbrdn"}

echo "📊 리소스 상태 확인 및 문제 해결"
echo "📁 네임스페이스: ${NAMESPACE}"
echo ""

# 1. 노드 리소스 할당량 확인
echo "=== 노드 리소스 할당량 ==="
kubectl get nodes -o custom-columns=NAME:.metadata.name,CPU-ALLOCATABLE:.status.allocatable.cpu,MEM-ALLOCATABLE:.status.allocatable.memory
echo ""

# 2. 노드별 리소스 요청량
echo "=== 노드별 리소스 요청량 ==="
for node in $(kubectl get nodes -o name | cut -d/ -f2); do
  echo "Node: $node"
  kubectl describe node $node | grep -A 5 "Allocated resources:" | grep -E "(cpu|memory)" | head -2
done
echo ""

# 3. Pod별 리소스 요청/제한
echo "=== Pod별 리소스 요청/제한 (${NAMESPACE}) ==="
if command -v jq &> /dev/null; then
  kubectl get pods -n ${NAMESPACE} -o json | jq -r '.items[] | "\(.metadata.name): CPU req=\(.spec.containers[0].resources.requests.cpu // "none"), CPU lim=\(.spec.containers[0].resources.limits.cpu // "none"), MEM req=\(.spec.containers[0].resources.requests.memory // "none"), MEM lim=\(.spec.containers[0].resources.limits.memory // "none")"'
else
  kubectl get pods -n ${NAMESPACE} -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[0].resources.requests.cpu}{"\t"}{.spec.containers[0].resources.limits.cpu}{"\n"}{end}' | column -t
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

