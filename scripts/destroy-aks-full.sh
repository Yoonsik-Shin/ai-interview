#!/bin/bash
set -e

# 🛑 All-Azure 인프라 증축분 파괴 및 원상 복구 스크립트
# ==================================================

echo "== [1/2] 추가 적치된 인프라 증축분 삭제 시작 (Terraform Destroy) =="
cd terraform

# 초기 전면 생성 모드가 아닌 기존 Final_2 AKS 활용 분기 변수를 동일하게 전달해야
# 안전하게 추가된 4개 자원(Postgres, Redis, ACR)만 안전 삭제됩니다.
terraform destroy -auto-approve \
  -var="create_resource_group=false" \
  -var="create_aks=false" \
  -var="resource_group_name=Final_2"

cd ..

echo "== [2/2] 인프라 증축분 파괴 성공 완료 =="
echo "💡 기존 리소스 그룹(Final_2) 및 AKS 클러스터(unbrdn-aks)는 정상 보존되었습니다."
