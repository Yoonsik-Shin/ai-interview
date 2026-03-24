#!/bin/bash
set -e

# ==========================================
# 🚀 ALL-Azure AKS 마이그레이션 통합 가동 스크립트
# ==========================================

echo "== [1/4] Terraform 인프라 프로비저닝 (증축) =="
cd terraform
# 초기 전면 생성 모드가 아닌 기존 Final_2 AKS 활용 분기로 변수 오버라이딩 적용
terraform init
terraform apply -auto-approve \
  -var="create_resource_group=false" \
  -var="create_aks=false" \
  -var="resource_group_name=Final_2"
cd ..

echo "== [2/4] AKS 자격 증명(Kubeconfig) 취득 =="
az aks get-credentials --resource-group Final_2 --name unbrdn-aks --overwrite-existing

echo "== [3/4] ArgoCD 설치 (Namespace: argocd) =="
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update
helm upgrade --install argocd argo/argo-cd --namespace argocd --create-namespace \
  --set server.service.type=LoadBalancer

echo "== [4/4] ArgoCD 초기 Pass 조회 가이드 =="
echo "ArgoCD 로드밸런서 IP가 프로비저닝 될 때까지 대기 중..."
sleep 10
kubectl get svc -n argocd argocd-server

echo ""
echo "--------------------------------------------------------"
echo "🛠️ [ArgoCD 대시보드 로그인 안내]"
echo "1. URL: 위 LoadBalancer 공인 IP를 브라우저에 입력"
echo "2. ID: admin"
echo "3. Password 조회 명령어:"
echo "   kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath=\"{.data.password}\" | base64 -d"
echo "--------------------------------------------------------"
echo "✅ 클러스터 구축이 완료되었습니다. Git Sync 시킬 ArgoCD Application YAML 및 백엔드 앱 셋업에 따라 로드됩니다."
