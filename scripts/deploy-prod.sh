#!/bin/bash

# 프로덕션 환경 배포 스크립트 (OCI OKE)
# 사용법: ./scripts/deploy-prod.sh [IMAGE_REGISTRY] [IMAGE_TAG]
# 참고: .env 파일에서 환경 변수를 로드합니다. .env.example을 참고하세요.

set -e

# 프로젝트 루트 디렉토리로 이동
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

# .env 파일 로드 (존재하는 경우)
if [ -f .env ]; then
    echo "📝 .env 파일에서 환경 변수를 로드합니다..."
    set -a
    source .env
    set +a
else
    echo "⚠️  .env 파일이 없습니다. .env.example을 복사하여 .env 파일을 생성하세요."
    echo "   cp .env.example .env"
    echo ""
fi

# 환경 변수 또는 파라미터에서 값 가져오기 (파라미터가 우선)
IMAGE_REGISTRY=${1:-${IMAGE_REGISTRY:-"ap-chuncheon-1.ocir.io/axrywc89b6lf"}}
IMAGE_TAG=${2:-${IMAGE_TAG:-"latest"}}
NAMESPACE=${NAMESPACE:-"unbrdn"}
OCI_KE_CONTEXT=${OCI_KE_CONTEXT:-"unbrdn-oracle"}

echo "🚀 프로덕션 환경 배포를 시작합니다..."
echo "📦 이미지 레지스트리: ${IMAGE_REGISTRY}"
echo "🏷️  이미지 태그: ${IMAGE_TAG}"
echo "📁 네임스페이스: ${NAMESPACE}"

# OCI OKE 클러스터 컨텍스트로 전환
echo "🔄 Kubernetes 컨텍스트 확인 중..."
CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "")
if [ "$CURRENT_CONTEXT" != "$OCI_KE_CONTEXT" ]; then
    echo "⚠️  현재 컨텍스트: ${CURRENT_CONTEXT}"
    echo "🔄 OCI OKE 클러스터로 전환 중: ${OCI_KE_CONTEXT}"
    if kubectl config use-context "$OCI_KE_CONTEXT" 2>/dev/null; then
        echo "✅ 컨텍스트 전환 완료: ${OCI_KE_CONTEXT}"
    else
        echo "❌ 컨텍스트 전환 실패: ${OCI_KE_CONTEXT}"
        echo "   사용 가능한 컨텍스트 목록:"
        kubectl config get-contexts
        echo ""
        echo "   올바른 컨텍스트로 전환하거나 스크립트의 OCI_KE_CONTEXT 변수를 수정하세요."
        exit 1
    fi
else
    echo "✅ 이미 올바른 컨텍스트에 연결되어 있습니다: ${OCI_KE_CONTEXT}"
fi

# 클러스터 연결 확인
echo "🔍 클러스터 연결 확인 중..."
if ! kubectl cluster-info &>/dev/null; then
    echo "❌ 클러스터에 연결할 수 없습니다."
    exit 1
fi
echo "✅ 클러스터 연결 확인 완료"

# 환경 변수 설정
export IMAGE_REGISTRY=${IMAGE_REGISTRY}
export IMAGE_TAG=${IMAGE_TAG}

# 네임스페이스 생성
echo "📁 네임스페이스 생성 중..."
kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

# 1. Strimzi Operator 설치 확인 및 설치
echo "🔍 Strimzi Operator 설치 확인 중..."
if ! kubectl get deployment strimzi-cluster-operator -n kafka &>/dev/null; then
    echo "⚠️  Strimzi Operator가 설치되지 않았습니다."
    echo "📦 Strimzi Operator 설치 중..."
    
    # Kafka 네임스페이스 생성
    kubectl create namespace kafka --dry-run=client -o yaml | kubectl apply -f -
    
    # Strimzi Operator 설치
    if kubectl apply -f 'https://strimzi.io/install/latest?namespace=kafka' -n kafka; then
        echo "✅ Strimzi Operator 설치 완료"
        echo "⏳ Strimzi Operator가 준비될 때까지 대기 중..."
        kubectl wait --for=condition=available deployment/strimzi-cluster-operator -n kafka --timeout=300s || {
            echo "⚠️  Strimzi Operator 준비 시간이 초과되었습니다. 계속 진행합니다..."
        }
    else
        echo "❌ Strimzi Operator 설치 실패"
        exit 1
    fi
else
    echo "✅ Strimzi Operator가 이미 설치되어 있습니다."
fi

# 2. 인프라 배포
echo "📦 인프라 리소스 배포 중..."
# Note: PostgreSQL은 Oracle DB로 마이그레이션되어 더 이상 필요하지 않습니다.
# Oracle Autonomous Database는 외부 관리형 서비스로 별도 설정이 필요합니다.

kubectl apply -f k8s/infra/redis/redis-deployment-prod.yaml
kubectl apply -f k8s/infra/redis/redis-service.yaml

# 3. Kafka 클러스터 배포 (Strimzi)
echo "📨 Kafka 클러스터 배포 중..."
kubectl apply -f k8s/infra/kafka/kafka-configmap-prod.yaml -n kafka
kubectl apply -f k8s/infra/kafka/kafka-nodepool-prod.yaml -n kafka
kubectl apply -f k8s/infra/kafka/strimzi-kafka-prod.yaml -n kafka

echo "⏳ 인프라 Pod가 준비될 때까지 대기 중..."
# Note: Oracle Autonomous Database는 외부 관리형 서비스이므로 Pod 대기가 필요 없습니다.
echo "🔴 Redis 대기 중..."
if kubectl wait --for=condition=ready pod -l app=redis -n ${NAMESPACE} --timeout=120s 2>/dev/null; then
    echo "✅ Redis 준비 완료"
else
    echo "⚠️  Redis 준비 시간 초과. 계속 진행합니다."
fi
echo "📨 Kafka 대기 중..."
if kubectl wait --for=condition=ready pod -l strimzi.io/cluster=kafka-cluster -n kafka --timeout=600s 2>/dev/null; then
    echo "✅ Kafka 준비 완료"
else
    echo "⚠️  Kafka 준비 시간 초과. 계속 진행합니다."
fi

# 4. ConfigMap 및 Secret 배포
echo "⚙️  ConfigMap 및 Secret 배포 중..."
kubectl apply -f k8s/apps/bff/configmap-prod.yaml
kubectl apply -f k8s/apps/core/configmap-prod.yaml
kubectl apply -f k8s/apps/inference/configmap-prod.yaml
kubectl apply -f k8s/apps/inference/secret-prod.yaml
kubectl apply -f k8s/apps/socket/configmap-prod.yaml

# 5. 애플리케이션 배포
echo "📱 애플리케이션 배포 중..."
# 환경 변수 치환 후 배포
# Core 서비스 먼저 배포 (BFF가 gRPC로 연결하므로)
echo "🔷 Core 서비스 배포 중..."
envsubst < k8s/apps/core/deployment-prod.yaml | kubectl apply -f -
kubectl apply -f k8s/apps/core/service.yaml

echo "🔷 Inference 서비스 배포 중..."
envsubst < k8s/apps/inference/deployment-prod.yaml | kubectl apply -f -
kubectl apply -f k8s/apps/inference/service.yaml

echo "🔷 BFF 서비스 배포 중..."
envsubst < k8s/apps/bff/deployment-prod.yaml | kubectl apply -f -
kubectl apply -f k8s/apps/bff/service.yaml

echo "🔷 Socket 서비스 배포 중..."
envsubst < k8s/apps/socket/deployment-prod.yaml | kubectl apply -f -
kubectl apply -f k8s/apps/socket/service.yaml

echo "⏳ 애플리케이션 Pod가 준비될 때까지 대기 중..."
echo "🔷 Core 서비스 대기 중..."
if kubectl wait --for=condition=ready pod -l app=core -n ${NAMESPACE} --timeout=300s 2>/dev/null; then
    echo "✅ Core 서비스 준비 완료"
else
    echo "⚠️  Core 서비스 준비 시간 초과. 계속 진행합니다."
fi
echo "🔷 Inference 서비스 대기 중..."
if kubectl wait --for=condition=ready pod -l app=inference -n ${NAMESPACE} --timeout=180s 2>/dev/null; then
    echo "✅ Inference 서비스 준비 완료"
else
    echo "⚠️  Inference 서비스 준비 시간 초과. 계속 진행합니다."
fi
echo "🔷 BFF 서비스 대기 중..."
if kubectl wait --for=condition=ready pod -l app=bff -n ${NAMESPACE} --timeout=180s 2>/dev/null; then
    echo "✅ BFF 서비스 준비 완료"
else
    echo "⚠️  BFF 서비스 준비 시간 초과. 계속 진행합니다."
fi
echo "🔷 Socket 서비스 대기 중..."
if kubectl wait --for=condition=ready pod -l app=socket -n ${NAMESPACE} --timeout=180s 2>/dev/null; then
    echo "✅ Socket 서비스 준비 완료"
else
    echo "⚠️  Socket 서비스 준비 시간 초과. 계속 진행합니다."
fi

# 6. Kafka UI 배포
echo "🎨 Kafka UI 배포 중..."
kubectl apply -f k8s/infra/kafka/kafka-ui-deployment-prod.yaml
kubectl apply -f k8s/infra/kafka/kafka-ui-service.yaml

# 6. Cert-Manager 설치 확인 및 설치
echo "🔍 Cert-Manager 설치 확인 중..."
if ! kubectl get namespace cert-manager &>/dev/null; then
    echo "⚠️  Cert-Manager가 설치되지 않았습니다."
    echo "📦 Cert-Manager 설치 중..."
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.3/cert-manager.yaml
    echo "⏳ Cert-Manager가 준비될 때까지 대기 중..."
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=300s || {
        echo "⚠️  Cert-Manager 준비 시간이 초과되었습니다. 계속 진행합니다..."
    }
    echo "✅ Cert-Manager 설치 완료"
else
    echo "✅ Cert-Manager가 이미 설치되어 있습니다."
fi

# 7. ClusterIssuer 배포
echo "🔐 Let's Encrypt ClusterIssuer 배포 중..."
kubectl apply -f k8s/infra/cert-manager/cluster-issuer-prod.yaml
echo "⚠️  ClusterIssuer의 이메일 주소를 실제 이메일로 변경했는지 확인하세요!"

# 8. Ingress 배포
echo "🌐 Ingress 배포 중..."
kubectl apply -f k8s/common/ingress/ingress-prod.yaml
echo "⚠️  Ingress의 도메인을 실제 도메인으로 변경했는지 확인하세요!"

echo "✅ 프로덕션 환경 배포가 완료되었습니다!"
echo ""
echo "📊 배포 상태 확인:"
kubectl get pods -n ${NAMESPACE}
echo ""
echo "🔗 Ingress 정보:"
kubectl get ingress main-ingress -n ${NAMESPACE}
echo ""
echo "🌐 접근 가능한 엔드포인트:"
INGRESS_IP=$(kubectl get ingress main-ingress -n ${NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
INGRESS_HOST=$(kubectl get ingress main-ingress -n ${NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
if [ -n "$INGRESS_IP" ]; then
    INGRESS_URL_HTTP="http://${INGRESS_IP}"
    INGRESS_URL_HTTPS="https://${INGRESS_IP}"
elif [ -n "$INGRESS_HOST" ]; then
    INGRESS_URL_HTTP="http://${INGRESS_HOST}"
    INGRESS_URL_HTTPS="https://${INGRESS_HOST}"
else
    INGRESS_URL_HTTP="<Ingress IP/Hostname이 할당될 때까지 대기 중...>"
    INGRESS_URL_HTTPS="<Ingress IP/Hostname이 할당될 때까지 대기 중...>"
fi
echo "   - 메인 (HTTPS): ${INGRESS_URL_HTTPS}/"
echo "   - 메인 (HTTP, 자동 리다이렉션): ${INGRESS_URL_HTTP}/"
echo "   - 테스트 클라이언트: ${INGRESS_URL_HTTPS}/test-client"
echo "   - Kafka UI: ${INGRESS_URL_HTTPS}/admin"
echo ""
echo "🔐 TLS 인증서 상태:"
kubectl get certificate -n ${NAMESPACE} 2>/dev/null || echo "   인증서가 아직 발급되지 않았습니다. 몇 분 후 다시 확인하세요."
echo ""
echo "💡 팁:"
echo "   - Ingress IP가 할당되지 않았다면 몇 분 후 다시 확인하세요."
echo "   - TLS 인증서 발급은 몇 분이 걸릴 수 있습니다."
echo "   - 인증서 상태 확인: kubectl get certificate -n ${NAMESPACE}"
echo "   - 인증서 상세 정보: kubectl describe certificate tls-secret -n ${NAMESPACE}"

