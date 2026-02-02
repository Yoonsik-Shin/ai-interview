# Frontend (React SPA) Kubernetes 배포

프론트엔드 정적 파일은 Object Storage에 보관하고, Nginx Deployment의 initContainer가 다운로드 후 서빙합니다.

## 환경별 Storage

| 환경 | Storage | Secret | Bucket |
|------|---------|--------|--------|
| **로컬** | MinIO | `minio-credentials` | `frontend` |
| **프로덕션** | OCI Object Storage | `storage-secrets` | `frontend` |

- **로컬**: `k8s/apps/frontend/local/` + MinIO `frontend` 버킷 생성 Job
- **프로덕션**: `k8s/apps/frontend/prod/` + OCI `frontend` 버킷 (Storage와 동일 테넌시)

## 프로덕션 (OCI Object Storage)

### 사전 준비

1. **OCI 버킷 생성**
   - OCI 콘솔 → Object Storage → Bucket 생성
   - 이름: `frontend`
   - Public 혹은 S3 호환 접근 허용 (initContainer 다운로드용)

2. **Storage와 동일 시크릿 사용**
   - `storage-secrets`에 `OBJECT_STORAGE_ACCESS_KEY`, `OBJECT_STORAGE_SECRET_KEY` 설정
   - OCI Customer Secret Key (S3 호환) 사용

3. **ConfigMap**
   - `k8s/apps/frontend/prod/configmap.yaml`의 `OBJECT_STORAGE_ENDPOINT` 확인
   - 네임스페이스 포함 시: `https://{namespace}.objectstorage.{region}.oraclecloud.com`

### 배포

```bash
kubectl apply -f k8s/apps/frontend/common/ -n unbrdn
kubectl apply -f k8s/apps/frontend/prod/ -n unbrdn
```

## 로컬 (MinIO)

### 사전 준비

1. **MinIO `frontend` 버킷 생성**
   ```bash
   kubectl apply -f k8s/infra/minio/job-create-frontend-bucket.yaml
   ```

2. **프론트 빌드 → MinIO 업로드**
   ```bash
   cd frontend && pnpm build
   # mc 또는 upload 스크립트로 minio/frontend/ 에 업로드
   ```

### 배포

```bash
kubectl apply -f k8s/apps/frontend/common/ -n unbrdn
kubectl apply -f k8s/apps/frontend/local/ -n unbrdn
```

## Ingress

- `/` → frontend (Nginx)
- `/api` → BFF
- `/socket.io/` → Socket

 `k8s/common/ingress/prod/ingress.yaml` 참조.
