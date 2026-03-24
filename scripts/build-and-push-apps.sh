#!/bin/bash
set -e

# 🚀 마이크로서비스 도커 빌드 & ACR 푸시 통합 스크립트
# ==================================================

ACR_NAME="unbrdnacr.azurecr.io"

echo "== [1/4] Azure ACR 로그인 인증 =="
az acr login --name unbrdnacr

echo "== [2/4] 마이크로서비스 빌드 리스트 선언 =="
# 1) 도메인(Java) 서비스
DOMAINS=("auth" "interview" "payment" "resume")

# 2) 게이트웨이(Node) 서비스
GATEWAYS=("bff" "socket")

# 3) 인프라(Python) 서비스
INFRAS=("llm" "stt" "tts" "storage")

echo "== [3/4] 순차 빌드 및 푸시 시작 =="

# 예시: auth 서비스 빌드
for svc in "${DOMAINS[@]}"; do
  echo "👉 [도메인] $svc 빌드 및 푸시 중..."
  # dorker build -t $ACR_NAME/$svc:latest services/domains/$svc
  # docker push $ACR_NAME/$svc:latest
done

for svc in "${GATEWAYS[@]}"; do
  echo "👉 [게이트웨이] $svc 빌드 및 푸시 중..."
  # docker build -t $ACR_NAME/$svc:latest services/gateways/$svc
  # docker push $ACR_NAME/$svc:latest
done

for svc in "${INFRAS[@]}"; do
  echo "👉 [인프라] $svc 빌드 및 푸시 중..."
  # docker build -t $ACR_NAME/$svc:latest services/infra/$svc
  # docker push $ACR_NAME/$svc:latest
done

echo "== [4/4] 🚀 모든 이미지 ACR 푸시 완료 == "
echo "💡 이제 ArgoCD가 해당 ACR 이미지를 당겨와 AKS에 분산 배포합니다!"
