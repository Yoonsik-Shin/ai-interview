#!/bin/bash

# 로컬(Kind) Pod CrashLoopBackOff / 0/1 Ready 일괄 진단
# 사용법: ./scripts/diagnose-pods-local.sh [NAMESPACE]
# 상세 원인·조치: docs/POD_CRASH_LOCAL_DIAGNOSIS.md

set -e

NAMESPACE=${1:-"unbrdn"}
APPS=(core bff socket llm stt storage)

echo "🔍 로컬 Pod 진단 (CrashLoopBackOff / 0/1 Ready)"
echo "   네임스페이스: ${NAMESPACE}"
echo "   상세 가이드: docs/POD_CRASH_LOCAL_DIAGNOSIS.md"
echo ""

if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl이 설치되어 있지 않습니다."
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Pod 상태"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kubectl get pods -n "${NAMESPACE}" 2>/dev/null || true
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 Secret / ConfigMap 존재 여부"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for s in postgres-credentials core-jwt-keys llm-secrets stt-secrets tts-secrets storage-secrets; do
    if kubectl get secret "$s" -n "${NAMESPACE}" &>/dev/null; then echo "  ✅ $s"; else echo "  ❌ $s (없음)"; fi
done
for c in core-config bff-config socket-config llm-config storage-config stt-config; do
    if kubectl get configmap "$c" -n "${NAMESPACE}" &>/dev/null; then echo "  ✅ $c"; else echo "  ❌ $c (없음)"; fi
done
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📜 배포별 로그 (--tail=60) 및 Events"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for app in "${APPS[@]}"; do
    if ! kubectl get deployment "$app" -n "${NAMESPACE}" &>/dev/null; then
        echo "⏭️  $app: Deployment 없음 (스킵)"
        echo ""
        continue
    fi
    echo "────────── $app ──────────"
    echo "Events (최근):"
    pod=$(kubectl get pod -l "app=$app" -n "${NAMESPACE}" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
    if [ -n "$pod" ]; then
        kubectl describe pod "$pod" -n "${NAMESPACE}" 2>/dev/null | sed -n '/^Events:/,/^$/p' | tail -15
    else
        echo "  (Pod 없음)"
    fi
    echo "Logs (--tail=60):"
    kubectl logs "deployment/$app" -n "${NAMESPACE}" --tail=60 2>/dev/null || echo "  (로그 없음)"
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛠️ 인프라 (Kafka, Redis, MinIO, Postgres)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Kafka (kafka ns):"
kubectl get kafka -n kafka 2>/dev/null || echo "  (kafka CR 없음)"
kubectl get pods -n kafka -l 'strimzi.io/cluster=kafka-cluster' --no-headers 2>/dev/null | head -5 || true
echo ""
echo "Redis / MinIO / Postgres (${NAMESPACE}):"
kubectl get svc -n "${NAMESPACE}" 2>/dev/null | grep -E "redis|minio|postgres|oracle" || echo "  (해당 서비스 없음)"
kubectl get pods -n "${NAMESPACE}" -l 'app.kubernetes.io/name=redis' --no-headers 2>/dev/null || true
echo ""

echo "✅ 진단 완료. 위 로그·Events로 원인 확인 후 docs/POD_CRASH_LOCAL_DIAGNOSIS.md 참고."
