# Inference Service Secret 설정 가이드

## 주의사항

⚠️ **절대 실제 API 키를 파일에 저장하지 마세요!** Secret 파일은 git에 커밋되지 않도록 `.gitignore`에 포함되어 있습니다.

## Secret 생성 방법

### 방법 1: kubectl create secret (권장)

로컬 환경에서 Secret을 생성하려면 다음 명령어를 사용하세요:

```bash
kubectl create secret generic inference-secrets \
  --from-literal=OPENAI_API_KEY='your-actual-api-key-here' \
  --namespace=unbrdn \
  --dry-run=client -o yaml | kubectl apply -f -
```

### 방법 2: 환경 변수 사용

환경 변수에 API 키가 있는 경우:

```bash
export OPENAI_API_KEY='your-actual-api-key-here'
kubectl create secret generic inference-secrets \
  --from-literal=OPENAI_API_KEY="$OPENAI_API_KEY" \
  --namespace=unbrdn \
  --dry-run=client -o yaml | kubectl apply -f -
```

### 방법 3: 파일에서 읽기 (보안 주의)

`.env` 파일에서 읽기:

```bash
# .env 파일에서 OPENAI_API_KEY 읽기
source .env  # 또는 export OPENAI_API_KEY=$(grep OPENAI_API_KEY .env | cut -d '=' -f2)
kubectl create secret generic inference-secrets \
  --from-literal=OPENAI_API_KEY="$OPENAI_API_KEY" \
  --namespace=unbrdn \
  --dry-run=client -o yaml | kubectl apply -f -
```

## Secret 생성/업데이트

### 처음 생성하는 경우

```bash
kubectl create secret generic inference-secrets \
  --from-literal=OPENAI_API_KEY='your-actual-api-key-here' \
  --namespace=unbrdn \
  --dry-run=client -o yaml | kubectl apply -f -

# ⚠️ 중요: Secret 생성 후 Pod를 재시작해야 환경 변수가 적용됩니다!
kubectl rollout restart deployment inference -n unbrdn
```

### 기존 Secret 업데이트

```bash
kubectl create secret generic inference-secrets \
  --from-literal=OPENAI_API_KEY='new-api-key' \
  --namespace=unbrdn \
  --dry-run=client -o yaml | kubectl apply -f -

# ⚠️ 중요: Secret 업데이트 후 Pod를 재시작해야 새로운 값이 적용됩니다!
kubectl rollout restart deployment inference -n unbrdn
```

### 재시작 상태 확인

```bash
# 재시작 진행 상태 확인
kubectl rollout status deployment inference -n unbrdn

# 로그 확인 (정상 작동 확인)
kubectl logs -f -n unbrdn -l app=inference
```

## Secret 확인

```bash
# Secret 존재 확인
kubectl get secret inference-secrets -n unbrdn

# Secret 값 확인 (base64 디코딩 필요)
kubectl get secret inference-secrets -n unbrdn -o jsonpath='{.data.OPENAI_API_KEY}' | base64 -d
```

## 주의사항

- `secret-local.yaml.example` 파일은 예시일 뿐, 실제 키는 포함하지 않습니다
- 실제 `secret-local.yaml` 파일은 `.gitignore`에 포함되어 git에 커밋되지 않습니다
- 프로덕션 환경에서는 CI/CD 파이프라인이나 외부 Secret 관리 시스템(AWS Secrets Manager, HashiCorp Vault 등)을 사용하세요
