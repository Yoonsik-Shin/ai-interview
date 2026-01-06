#!/bin/bash

# Pod 오류 진단 스크립트
# 사용법: ./scripts/debug-pods.sh [NAMESPACE]
# 예시: ./scripts/debug-pods.sh unbrdn

set -e

NAMESPACE=${1:-"unbrdn"}

echo "🔍 Pod 오류 진단을 시작합니다..."
echo "📁 네임스페이스: ${NAMESPACE}"
echo ""

# 1. Pod 상태 확인
echo "📊 Pod 상태 확인:"
kubectl get pods -n ${NAMESPACE}
echo ""

# 2. Core Pod 상세 정보
echo "⚙️  Core Pod 상세 정보:"
if kubectl get pod -l app=core -n ${NAMESPACE} 2>/dev/null | grep -q core; then
    CORE_PODS=($(kubectl get pod -l app=core -n ${NAMESPACE} -o jsonpath='{.items[*].metadata.name}'))
    for CORE_POD in "${CORE_PODS[@]}"; do
        echo "Pod 이름: ${CORE_POD}"
        echo ""
        echo "이벤트:"
        kubectl describe pod ${CORE_POD} -n ${NAMESPACE} | grep -A 10 "Events:" || echo "이벤트 없음"
        echo ""
        echo "이미지 정보:"
        kubectl get pod ${CORE_POD} -n ${NAMESPACE} -o jsonpath='{.spec.containers[0].image}' && echo ""
        echo ""
        echo "최근 로그 (마지막 20줄):"
        kubectl logs ${CORE_POD} -n ${NAMESPACE} --tail=20 || echo "로그를 가져올 수 없습니다."
        echo ""
        echo "---"
        echo ""
    done
else
    echo "⚠️  Core Pod를 찾을 수 없습니다."
fi
echo ""

# 3. Deployment 확인
echo "📦 Deployment 확인:"
kubectl get deployment -n ${NAMESPACE} -o wide
echo ""

# 4. ConfigMap 및 Secret 확인
echo "🔐 ConfigMap 및 Secret 확인:"
echo "Core ConfigMap:"
kubectl get configmap core-config -n ${NAMESPACE} 2>/dev/null && echo "✅ 존재함" || echo "❌ 없음"
echo ""

# 5. 이미지 Pull Secret 확인
echo "🔑 이미지 Pull Secret 확인:"
kubectl get secret ocir-secret -n ${NAMESPACE} 2>/dev/null && echo "✅ 존재함" || echo "❌ 없음"
echo ""

echo "✅ 진단 완료"

