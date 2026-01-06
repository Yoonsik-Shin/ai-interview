#!/bin/bash

# 로컬 환경 배포 스크립트 (Docker Desktop)
# 사용법: ./scripts/deploy-local.sh

set -e

NAMESPACE="unbrdn"

echo "🚀 로컬 환경 배포를 시작합니다..."

# 네임스페이스 생성
echo "📁 네임스페이스 생성 중..."
kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

# 1. 인프라 배포
echo "📦 인프라 리소스 배포 중..."
kubectl apply -f k8s/infra/redis/redis-deployment-local.yaml
kubectl apply -f k8s/infra/redis/redis-service.yaml

kubectl apply -f k8s/infra/kafka/zookeeper-deployment-local.yaml
kubectl apply -f k8s/infra/kafka/zookeeper-service.yaml
kubectl apply -f k8s/infra/kafka/kafka-deployment-local.yaml
kubectl apply -f k8s/infra/kafka/kafka-service.yaml

echo "⏳ 인프라 Pod가 준비될 때까지 대기 중..."
kubectl wait --for=condition=ready pod -l app=redis -n ${NAMESPACE} --timeout=120s || true
kubectl wait --for=condition=ready pod -l app=zookeeper -n ${NAMESPACE} --timeout=120s || true
kubectl wait --for=condition=ready pod -l app=kafka -n ${NAMESPACE} --timeout=120s || true

# 2. 애플리케이션 배포
echo "📱 애플리케이션 배포 중..."

# Inference Secret 확인 및 안내
if ! kubectl get secret inference-secrets -n ${NAMESPACE} &>/dev/null; then
  echo "⚠️  Inference Secret이 없습니다."
  echo "   다음 명령어로 Secret을 생성하세요:"
  echo "   kubectl create secret generic inference-secrets \\"
  echo "     --from-literal=OPENAI_API_KEY='your-api-key-here' \\"
  echo "     --namespace=${NAMESPACE} \\"
  echo "     --dry-run=client -o yaml | kubectl apply -f -"
  echo ""
  echo "   자세한 내용: k8s/apps/inference/README-secret.md"
  echo ""
fi

kubectl apply -f k8s/apps/inference/env-configmap-local.yaml
kubectl apply -f k8s/apps/core/deployment-local.yaml
kubectl apply -f k8s/apps/core/service.yaml
kubectl apply -f k8s/apps/inference/deployment-local.yaml
kubectl apply -f k8s/apps/inference/service.yaml
kubectl apply -f k8s/apps/bff/deployment-local.yaml
kubectl apply -f k8s/apps/bff/service.yaml
kubectl apply -f k8s/apps/socket/configmap-local.yaml
kubectl apply -f k8s/apps/socket/deployment-local.yaml
kubectl apply -f k8s/apps/socket/service.yaml

# 3. Kafka UI 배포
echo "🎨 Kafka UI 배포 중..."
kubectl apply -f k8s/infra/kafka/kafka-ui-deployment-local.yaml
kubectl apply -f k8s/infra/kafka/kafka-ui-service.yaml

# 4. 자체 서명 인증서 생성
echo "🔐 자체 서명 인증서 생성 중..."
if ! kubectl get secret tls-secret -n ${NAMESPACE} &>/dev/null; then
    echo "📝 인증서 생성 중..."
    ./scripts/generate-self-signed-cert.sh
else
    echo "✅ 인증서가 이미 존재합니다."
fi

# 5. Ingress 배포
echo "🌐 Ingress 배포 중..."
kubectl apply -f k8s/common/ingress/ingress-local.yaml

echo "✅ 로컬 환경 배포가 완료되었습니다!"
echo ""
echo "📊 배포 상태 확인:"
kubectl get pods -n ${NAMESPACE}
echo ""
echo "🔗 서비스 접속 정보:"
echo "  - BFF (HTTPS): https://localhost/api"
echo "  - BFF (HTTP, 자동 리다이렉션): http://localhost/api"
echo "  - Socket (HTTPS): https://localhost/socket.io"
echo "  - Kafka UI (HTTPS): https://localhost/admin"
echo ""
echo "⚠️  참고: 자체 서명 인증서이므로 브라우저에서 '고급' → '안전하지 않음으로 이동'을 클릭해야 접속할 수 있습니다."

