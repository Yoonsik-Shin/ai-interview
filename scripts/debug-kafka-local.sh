#!/bin/bash
# 로컬 Kind 환경에서 Kafka Pool 미기동 시 진단 스크립트
# 사용법: ./scripts/debug-kafka-local.sh

set -e

KAFKA_NS="kafka"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Kafka 로컬 진단 (Kind + Strimzi)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "=== 1. StorageClass (Kafka PVC용) ==="
kubectl get storageclass 2>/dev/null || true
DEFAULT_SC=$(kubectl get storageclass -o jsonpath='{.items[?(@.metadata.annotations.storageclass\.kubernetes\.io/is-default-class=="true")].metadata.name}' 2>/dev/null || echo "")
if [ -z "$DEFAULT_SC" ]; then
    echo "⚠️  default StorageClass 없음 → Kafka PVC Pending 가능. deploy-local에서 local-path 설치 후 default 설정 확인."
else
    echo "   default: $DEFAULT_SC"
fi
echo ""

echo "=== 2. Kafka CR / KafkaNodePool ==="
kubectl get kafka,kafkanodepool -n "$KAFKA_NS" 2>/dev/null || true
echo ""

echo "=== 3. Kafka Cluster 상세 (Status) ==="
kubectl get kafka kafka-cluster -n "$KAFKA_NS" -o jsonpath='{.status}' 2>/dev/null | head -c 2000
echo ""
echo ""

echo "=== 4. KafkaNodePool 상세 (Status) ==="
kubectl get kafkanodepool kafka-pool -n "$KAFKA_NS" -o jsonpath='{.status}' 2>/dev/null | head -c 2000
echo ""
echo ""

echo "=== 5. Pods (kafka NS) ==="
kubectl get pods -n "$KAFKA_NS" 2>/dev/null || true
echo ""

echo "=== 6. PVC (kafka NS) ==="
kubectl get pvc -n "$KAFKA_NS" 2>/dev/null || true
echo ""

echo "=== 7. Strimzi Operator 로그 (최근 80줄) ==="
kubectl logs -n "$KAFKA_NS" deployment/strimzi-cluster-operator --tail=80 2>/dev/null || true
echo ""

echo "=== 8. Strimzi Operator 이전 크래시 로그 (RESTARTS 있는 경우) ==="
OP_RESTARTS=$(kubectl get pods -n "$KAFKA_NS" --no-headers 2>/dev/null | grep strimzi-cluster-operator | awk '$4 ~ /^[1-9]/ {print $4; exit}' || true)
if [ -n "$OP_RESTARTS" ]; then
    kubectl logs -n "$KAFKA_NS" deployment/strimzi-cluster-operator --previous --tail=60 2>/dev/null || echo "   (이전 로그 없음)"
else
    echo "   (재시작 없음)"
fi
echo ""

echo "=== 9. 최근 이벤트 (kafka NS) ==="
kubectl get events -n "$KAFKA_NS" --sort-by='.lastTimestamp' 2>/dev/null | tail -25
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 자주 있는 원인"
echo "   • default StorageClass 없음 → deploy-local이 local-path 설치 및 default 설정하는지 확인"
echo "   • Strimzi Operator 재시작 → OOM/log 에러 확인. Docker 메모리 4GB+ 권장"
echo "   • PVC Pending → StorageClass 존재·default 여부, local-path-provisioner Pod Running 확인"
echo "   • Kafka CR/NodePool 상태 NotReady → Operator 로그에서 reconcile 에러 확인"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
