# Oracle 인프라 설정 (OKE Production)

## 개요

OKE 프로덕션 환경에서 사용하는 Oracle ATP 및 Object Storage 연결 설정입니다.

## 설정 방법

### 1. Oracle ATP Secret 설정

`oracle-atp-secret.yaml` 파일을 실제 값으로 수정:

```bash
# 1. OCI 콘솔에서 ATP 연결 문자열 확인
# Database Connection → Connection Strings → TLS → _high 엔드포인트 복사

# 2. Secret 파일 수정
vi k8s/infra/oracle/prod/oracle-atp-secret.yaml

# 3. 다음 값 변경:
# - password: ATP 비밀번호
# - connection-string: ATP 연결 문자열 (_high 엔드포인트)
```

### 2. Oracle Object Storage Secret 설정

`object-storage-secret.yaml` 파일을 실제 값으로 수정:

```bash
# 1. OCI API Key 생성 (아직 없는 경우)
# OCI 콘솔 → User Settings → API Keys → Add API Key

# 2. Secret 파일 수정
vi k8s/infra/oracle/prod/object-storage-secret.yaml

# 3. 다음 값 변경:
# - tenancy-id: OCI Tenancy OCID
# - user-id: OCI User OCID
# - fingerprint: API Key Fingerprint
# - private-key: API Private Key (PEM 형식)
# - region: OCI Region (예: ap-seoul-1)
```

### 3. Object Storage ConfigMap 설정

`object-storage-configmap.yaml` 파일을 실제 값으로 수정:

```bash
# 1. Object Storage Namespace 확인
# OCI 콘솔 → Object Storage → Buckets → Namespace 확인

# 2. ConfigMap 파일 수정
vi k8s/infra/oracle/prod/object-storage-configmap.yaml

# 3. 다음 값 변경:
# - namespace: Object Storage Namespace
# - endpoint: Region에 맞는 Endpoint
```

### 4. Bucket 생성

```bash
# OCI CLI로 Bucket 생성
oci os bucket create \
  --compartment-id <COMPARTMENT_OCID> \
  --name interview-archives \
  --namespace <NAMESPACE>

# 또는 OCI 콘솔에서 수동 생성
```

### 5. Kubernetes에 적용

```bash
# Secret 및 ConfigMap 적용
kubectl apply -f k8s/infra/oracle/prod/

# 확인
kubectl get secret -n unbrdn | grep oracle
kubectl get configmap -n unbrdn | grep oracle
kubectl get configmap -n unbrdn | grep oci
```

## 주의사항

### 보안

- **Secret 파일을 Git에 커밋하지 마세요**
- 실제 환경에서는 Sealed Secrets 또는 External Secrets Operator 사용 권장
- Private Key는 절대 공개하지 마세요

### Always Free 제한

#### Oracle ATP

- **동시 세션**: 최대 30개
- **자동 정지**: 7일간 활동 없으면 자동 정지
- **Private Endpoint 미지원**: 퍼블릭 인터넷 연결만 가능

Connection Pool 설정으로 세션 수 제한:

```yaml
hikari-maximum-pool-size: "10" # 최대 10개 연결
```

#### Object Storage

- **용량**: 총 20GB
- **API 요청**: 월 50,000회

## 트러블슈팅

### ATP 연결 실패

```bash
# Core Pod 로그 확인
kubectl logs -l app=core -n unbrdn

# Secret 확인
kubectl get secret oracle-atp-credentials -n unbrdn -o yaml

# ConfigMap 확인
kubectl get configmap oracle-atp-config -n unbrdn -o yaml
```

### Object Storage 연결 실패

```bash
# Storage Pod 로그 확인
kubectl logs -l app=storage -n unbrdn

# Secret 확인
kubectl get secret oci-object-storage-credentials -n unbrdn -o yaml

# OCI CLI로 인증 테스트
oci os bucket list --namespace <NAMESPACE>
```

## 참고 문서

- [Oracle ATP 설정 가이드](../../docs/oracle-db-setup.md)
- [OCI Always Free 리소스](../../../archive/docs/oracle-cloud-always-free.md)
- [아키텍처 문서](../../docs/architecture.md)
