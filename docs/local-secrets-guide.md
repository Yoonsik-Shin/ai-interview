# 로컬 환경 Secrets 설정 가이드

로컬 Kubernetes (Kind) 환경에서 필요한 모든 Secrets를 생성하는 방법을 정리합니다.

## 🚀 배포 시 입력으로 생성 (권장)

`./scripts/deploy-local.sh` 실행 시, 누락된 Secrets가 있으면 **입력으로 생성할지** 물어봅니다.

- **Y** → 각 Secret별로 프롬프트가 뜹니다. 값을 입력하면 `kubectl create secret`으로 생성 후 배포를 이어갑니다.
- **n** → 배포 중단. 아래 수동 생성 후 다시 배포하세요.

| Secret | 입력 방식 |
|--------|-----------|
| llm-secrets | OpenAI API Key (Enter=건너뜀) |
| stt-secrets | OpenAI API Key (Enter=LLM과 동일 키 사용) |
| tts-secrets | OpenAI API Key (Enter=LLM과 동일 키 사용) |
| storage-secrets | MinIO/OCI Access Key, Secret Key (Enter=minioadmin) |
| oracle-db-credentials | DB Username (기본 ADMIN), Password |
| core-jwt-keys | 자동 생성 (RSA 2048) |
| minio-credentials | MinIO Root User/Password (Enter=minioadmin) |

이미 존재하는 Secret은 건너뛰고, **없는 것만** 입력받아 생성합니다.

---

## 📋 필수 Secrets 목록 (수동 생성)

### 1. **llm-secrets** (LLM 서비스)
OpenAI API 키가 필요합니다.

```bash
kubectl create secret generic llm-secrets \
  --from-literal=OPENAI_API_KEY='sk-your-actual-api-key-here' \
  --namespace=unbrdn \
  --dry-run=client -o yaml | kubectl apply -f -
```

**참고**: `k8s/apps/llm/common/README-secret.md` 참조

---

### 2. **stt-secrets** (STT 서비스)
OpenAI API 키가 필요합니다 (Whisper API 사용 시).

```bash
kubectl create secret generic stt-secrets \
  --from-literal=OPENAI_API_KEY='sk-your-actual-api-key-here' \
  --namespace=unbrdn \
  --dry-run=client -o yaml | kubectl apply -f -
```

**참고**: `k8s/apps/stt/common/secret.yaml` 참조

---

### 3. **tts-secrets** (TTS 서비스)
OpenAI API 키가 필요합니다 (TTS API 사용 시).

```bash
kubectl create secret generic tts-secrets \
  --from-literal=OPENAI_API_KEY='sk-your-actual-api-key-here' \
  --namespace=unbrdn \
  --dry-run=client -o yaml | kubectl apply -f -
```

**참고**: `k8s/apps/tts/common/secret.yaml` 참조

---

### 4. **storage-secrets** (Storage 서비스)
Object Storage (MinIO 또는 OCI Object Storage) 크레덴셜이 필요합니다.

#### 로컬 MinIO 사용 시 (기본값)
```bash
kubectl create secret generic storage-secrets \
  --from-literal=OBJECT_STORAGE_ACCESS_KEY='minioadmin' \
  --from-literal=OBJECT_STORAGE_SECRET_KEY='minioadmin' \
  --namespace=unbrdn \
  --dry-run=client -o yaml | kubectl apply -f -
```

#### OCI Object Storage 사용 시
```bash
kubectl create secret generic storage-secrets \
  --from-literal=OBJECT_STORAGE_ACCESS_KEY='your-oci-access-key' \
  --from-literal=OBJECT_STORAGE_SECRET_KEY='your-oci-secret-key' \
  --namespace=unbrdn \
  --dry-run=client -o yaml | kubectl apply -f -
```

**참고**: `k8s/apps/storage/common/secret.yaml` 참조

---

### 5. **oracle-db-credentials** (Core 서비스)
Oracle Autonomous Database 자격 증명이 필요합니다.

```bash
kubectl create secret generic oracle-db-credentials \
  --from-literal=username='ADMIN' \
  --from-literal=password='YOUR_ACTUAL_PASSWORD' \
  --namespace=unbrdn \
  --dry-run=client -o yaml | kubectl apply -f -
```

**참고**: 
- `k8s/infra/oracle/README.md` 참조
- Oracle Always Free Tier 사용 가능 (비용 $0/월)
- Connection String은 `k8s/infra/oracle/oracle-configmap-local.yaml`에서 설정

---

### 6. **core-jwt-keys** (Core 서비스)
JWT 토큰 서명을 위한 RSA 키 쌍이 필요합니다.

#### JWT 키 생성 (RSA 2048)
```bash
# Private Key 생성
openssl genrsa -out jwt-private.pem 2048

# Public Key 추출
openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem

# Base64 인코딩 (헤더/푸터 제거)
PRIVATE_KEY=$(cat jwt-private.pem | sed -e '1d' -e '$d' | tr -d '\n')
PUBLIC_KEY=$(cat jwt-public.pem | sed -e '1d' -e '$d' | tr -d '\n')
```

#### Secret 생성
```bash
kubectl create secret generic core-jwt-keys \
  --from-literal=JWT_KEY_0_KID='jwt-key-0' \
  --from-literal=JWT_KEY_0_PRIVATE_KEY="$PRIVATE_KEY" \
  --from-literal=JWT_KEY_0_PUBLIC_KEY="$PUBLIC_KEY" \
  --from-literal=JWT_KEY_0_ACTIVE='true' \
  --namespace=unbrdn \
  --dry-run=client -o yaml | kubectl apply -f -
```

**참고**:
- Core 서비스는 `core-jwt-keys` Secret에서 JWT 키를 읽습니다.
- `JWT_KEY_0_*`는 필수, `JWT_KEY_1_*`는 선택 (키 로테이션용)
- `JWT_KEY_0_ACTIVE`는 `true`로 설정

---

### 7. **minio-credentials** (MinIO - 로컬 Object Storage)
로컬 MinIO를 사용하는 경우 필요합니다.

```bash
kubectl create secret generic minio-credentials \
  --from-literal=MINIO_ROOT_USER='minioadmin' \
  --from-literal=MINIO_ROOT_PASSWORD='minioadmin' \
  --namespace=unbrdn \
  --dry-run=client -o yaml | kubectl apply -f -
```

**참고**: `k8s/infra/minio/secret.yaml` 참조

---

## 🚀 한 번에 생성하기

다음 스크립트를 사용하여 모든 필수 Secrets를 한 번에 생성할 수 있습니다:

```bash
#!/bin/bash
# local-secrets-setup.sh

NAMESPACE="unbrdn"

# 1. LLM Secrets
echo "🔐 LLM Secret 생성 중..."
read -sp "OpenAI API Key (LLM): " LLM_API_KEY
echo ""
kubectl create secret generic llm-secrets \
  --from-literal=OPENAI_API_KEY="$LLM_API_KEY" \
  --namespace=${NAMESPACE} \
  --dry-run=client -o yaml | kubectl apply -f -

# 2. STT Secrets
echo "🔐 STT Secret 생성 중..."
read -sp "OpenAI API Key (STT): " STT_API_KEY
echo ""
kubectl create secret generic stt-secrets \
  --from-literal=OPENAI_API_KEY="$STT_API_KEY" \
  --namespace=${NAMESPACE} \
  --dry-run=client -o yaml | kubectl apply -f -

# 3. TTS Secrets
echo "🔐 TTS Secret 생성 중..."
read -sp "OpenAI API Key (TTS): " TTS_API_KEY
echo ""
kubectl create secret generic tts-secrets \
  --from-literal=OPENAI_API_KEY="$TTS_API_KEY" \
  --namespace=${NAMESPACE} \
  --dry-run=client -o yaml | kubectl apply -f -

# 4. Storage Secrets (MinIO 기본값)
echo "🔐 Storage Secret 생성 중 (MinIO 기본값)..."
kubectl create secret generic storage-secrets \
  --from-literal=OBJECT_STORAGE_ACCESS_KEY='minioadmin' \
  --from-literal=OBJECT_STORAGE_SECRET_KEY='minioadmin' \
  --namespace=${NAMESPACE} \
  --dry-run=client -o yaml | kubectl apply -f -

# 5. Oracle DB Credentials
echo "🔐 Oracle DB Secret 생성 중..."
read -p "Oracle DB Username (기본: ADMIN): " DB_USERNAME
DB_USERNAME=${DB_USERNAME:-ADMIN}
read -sp "Oracle DB Password: " DB_PASSWORD
echo ""
kubectl create secret generic oracle-db-credentials \
  --from-literal=username="$DB_USERNAME" \
  --from-literal=password="$DB_PASSWORD" \
  --namespace=${NAMESPACE} \
  --dry-run=client -o yaml | kubectl apply -f -

# 6. JWT Keys
echo "🔐 JWT Keys 생성 중..."
if [ ! -f jwt-private.pem ]; then
    echo "RSA 키 쌍 생성 중..."
    openssl genrsa -out jwt-private.pem 2048
    openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem
fi

PRIVATE_KEY=$(cat jwt-private.pem | sed -e '1d' -e '$d' | tr -d '\n')
PUBLIC_KEY=$(cat jwt-public.pem | sed -e '1d' -e '$d' | tr -d '\n')

kubectl create secret generic core-jwt-keys \
  --from-literal=JWT_KEY_0_KID='jwt-key-0' \
  --from-literal=JWT_KEY_0_PRIVATE_KEY="$PRIVATE_KEY" \
  --from-literal=JWT_KEY_0_PUBLIC_KEY="$PUBLIC_KEY" \
  --from-literal=JWT_KEY_0_ACTIVE='true' \
  --namespace=${NAMESPACE} \
  --dry-run=client -o yaml | kubectl apply -f -

# 7. MinIO Credentials
echo "🔐 MinIO Secret 생성 중..."
kubectl create secret generic minio-credentials \
  --from-literal=MINIO_ROOT_USER='minioadmin' \
  --from-literal=MINIO_ROOT_PASSWORD='minioadmin' \
  --namespace=${NAMESPACE} \
  --dry-run=client -o yaml | kubectl apply -f -

echo ""
echo "✅ 모든 Secrets 생성 완료!"
echo ""
echo "📋 생성된 Secrets 확인:"
kubectl get secrets -n ${NAMESPACE} | grep -E "llm-secrets|stt-secrets|tts-secrets|storage-secrets|oracle-db-credentials|core-jwt-keys|minio-credentials"
```

---

## ✅ Secrets 확인

### 모든 Secrets 목록 확인
```bash
kubectl get secrets -n unbrdn
```

### 특정 Secret 확인
```bash
# Secret 존재 확인
kubectl get secret <secret-name> -n unbrdn

# Secret 값 확인 (base64 디코딩)
kubectl get secret <secret-name> -n unbrdn -o jsonpath='{.data.<key>}' | base64 -d
```

### 예시: LLM Secret 확인
```bash
kubectl get secret llm-secrets -n unbrdn -o jsonpath='{.data.OPENAI_API_KEY}' | base64 -d
```

---

## 🔄 Secret 업데이트

Secret을 업데이트한 후에는 해당 Pod를 재시작해야 합니다:

```bash
# Secret 업데이트
kubectl create secret generic <secret-name> \
  --from-literal=<key>=<new-value> \
  --namespace=unbrdn \
  --dry-run=client -o yaml | kubectl apply -f -

# Pod 재시작
kubectl rollout restart deployment/<service-name> -n unbrdn

# 재시작 상태 확인
kubectl rollout status deployment/<service-name> -n unbrdn
```

---

## ⚠️ 주의사항

1. **절대 Git에 커밋하지 마세요**
   - Secret 파일은 `.gitignore`에 포함되어 있습니다
   - 실제 API 키나 비밀번호는 환경 변수나 별도 보안 저장소에서 관리하세요

2. **로컬 개발 시**
   - OpenAI API 키는 비용이 발생합니다 — 사용량 모니터링 필수
   - MinIO는 로컬 테스트용으로 기본값(`minioadmin`/`minioadmin`) 사용 가능

3. **Oracle DB**
   - Always Free Tier 사용 가능 ($0/월)
   - 7일간 활동이 없으면 자동 정지 (데이터는 보존)
   - Connection String은 `k8s/infra/oracle/oracle-configmap-local.yaml`에서 설정

4. **JWT Keys**
   - RSA 2048 비트 이상 권장
   - Private Key는 절대 노출되지 않도록 주의
   - 키 로테이션을 위해 `JWT_KEY_1_*`도 설정 가능

---

## 📚 참고 문서

- 환경 변수 가이드: `docs/environment-variables.md`
- Oracle DB 설정: `k8s/infra/oracle/README.md`
- LLM Secret 가이드: `k8s/apps/llm/common/README-secret.md`
- 배포 가이드: `docs/ops_consolidated.md`
