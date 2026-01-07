#!/bin/bash

# 로컬 환경용 자체 서명 인증서 생성 스크립트
# 사용법: ./scripts/generate-self-signed-cert.sh

set -e

NAMESPACE="unbrdn"
SECRET_NAME="tls-secret"
DOMAIN="localhost"
CERT_DIR="/tmp/k8s-certs"

echo "🔐 자체 서명 인증서 생성 중..."

# 임시 디렉토리 생성
mkdir -p ${CERT_DIR}
cd ${CERT_DIR}

# 개인키 생성
echo "📝 개인키 생성 중..."
openssl genrsa -out tls.key 2048

# 인증서 서명 요청(CSR) 생성
echo "📝 인증서 서명 요청 생성 중..."
openssl req -new -key tls.key -out tls.csr -subj "/CN=${DOMAIN}/O=Local Development"

# 자체 서명 인증서 생성 (유효기간: 365일)
echo "📝 자체 서명 인증서 생성 중..."
openssl x509 -req -days 365 -in tls.csr -signkey tls.key -out tls.crt

# Kubernetes Secret 생성
echo "📦 Kubernetes Secret 생성 중..."
kubectl create secret tls ${SECRET_NAME} \
  --cert=tls.crt \
  --key=tls.key \
  --namespace=${NAMESPACE} \
  --dry-run=client -o yaml | kubectl apply -f -

# 임시 파일 정리
echo "🧹 임시 파일 정리 중..."
cd - > /dev/null
rm -rf ${CERT_DIR}

echo "✅ 자체 서명 인증서 생성 완료!"
echo "   Secret 이름: ${SECRET_NAME}"
echo "   네임스페이스: ${NAMESPACE}"
echo ""
echo "⚠️  참고: 브라우저에서 '고급' → '안전하지 않음으로 이동'을 클릭해야 접속할 수 있습니다."




