#!/bin/bash

# Strimzi Kafka Operator 로컬 설치 스크립트
# 사용법: ./scripts/setup-strimzi-local.sh

set -e

KAFKA_NAMESPACE="kafka"

echo "🚀 Strimzi Kafka Operator 설치를 시작합니다..."
echo ""

# kubectl 설치 확인
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl이 설치되어 있지 않습니다."
    echo "   설치 가이드: https://kubernetes.io/docs/tasks/tools/"
    exit 1
fi

# 쿠버네티스 클러스터 연결 확인
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ 쿠버네티스 클러스터에 연결할 수 없습니다."
    exit 1
fi

echo "✅ Kubernetes 클러스터 연결 확인 완료"
echo ""

# 1. Kafka 네임스페이스 생성
echo "📁 Kafka 네임스페이스 생성 중..."
kubectl create namespace ${KAFKA_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
echo "✅ Kafka 네임스페이스 준비 완료"
echo ""

# 2. Strimzi Operator가 이미 설치되어 있는지 확인
if kubectl get deployment strimzi-cluster-operator -n ${KAFKA_NAMESPACE} &> /dev/null; then
    echo "✅ Strimzi Operator가 이미 설치되어 있습니다."
    echo ""
    
    # Operator 상태 확인
    echo "📊 Strimzi Operator 상태:"
    kubectl get deployment strimzi-cluster-operator -n ${KAFKA_NAMESPACE}
    echo ""
    
    read -p "Strimzi Operator를 재설치하시겠습니까? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "⏭️  Operator 설치를 건너뜁니다."
        echo ""
        exit 0
    fi
    
    echo "🗑️  기존 Strimzi Operator 제거 중..."
    kubectl delete deployment strimzi-cluster-operator -n ${KAFKA_NAMESPACE} || true
    echo ""
fi

# 3. Strimzi Operator 최신 버전 설치
echo "📦 Strimzi Operator 설치 중..."
echo "   버전: 최신 (Strimzi 공식 릴리즈)"
echo ""

# Strimzi Operator 설치 (최신 버전)
kubectl create -f 'https://strimzi.io/install/latest?namespace=kafka' -n ${KAFKA_NAMESPACE}

echo "⏳ Strimzi Operator가 준비될 때까지 대기 중..."
kubectl wait --for=condition=available deployment/strimzi-cluster-operator \
    -n ${KAFKA_NAMESPACE} \
    --timeout=300s || {
        echo "❌ Strimzi Operator 설치 실패!"
        echo ""
        echo "💡 문제 해결 방법:"
        echo "   1. Operator 로그 확인:"
        echo "      kubectl logs -n ${KAFKA_NAMESPACE} deployment/strimzi-cluster-operator"
        echo "   2. Pod 상태 확인:"
        echo "      kubectl get pods -n ${KAFKA_NAMESPACE}"
        echo "   3. 이벤트 확인:"
        echo "      kubectl get events -n ${KAFKA_NAMESPACE} --sort-by='.lastTimestamp'"
        exit 1
    }

echo ""
echo "✅ Strimzi Operator 설치 완료!"
echo ""

# 4. Operator 상태 확인
echo "📊 Strimzi Operator 상태:"
kubectl get deployment -n ${KAFKA_NAMESPACE}
echo ""

echo "🎉 Strimzi Kafka Operator 설치가 완료되었습니다!"
echo ""
echo "💡 다음 단계:"
echo "   1. Kafka 클러스터 배포:"
echo "      kubectl apply -f k8s/infra/kafka/strimzi-kafka-local.yaml"
echo ""
echo "   2. Kafka 클러스터 상태 확인:"
echo "      kubectl get kafka -n ${KAFKA_NAMESPACE}"
echo "      kubectl get pods -n ${KAFKA_NAMESPACE}"
echo ""
echo "   3. 전체 로컬 환경 배포:"
echo "      ./scripts/deploy-local.sh"
echo ""
