# 로컬(Kind) Pod CrashLoopBackOff 진단 가이드

로컬 `deploy-local.sh` 배포 후 **core, bff, socket, llm, stt, storage** 등이 **CrashLoopBackOff** 또는 **0/1 Running**일 때 원인 파악 및 조치 방법입니다.

---

## 0. 빠른 진단 (로컬 터미널에서 실행)

**Cursor/IDE 환경에서는 `kubectl`이 클러스터에 접속하지 못할 수 있습니다.** 아래 명령은 반드시 **로컬 터미널**에서 실행하세요.

```bash
# 진단 스크립트 (Pod 상태, Secret/ConfigMap, 로그, 인프라)
./scripts/diagnose-pods-local.sh unbrdn
```

또는 수동 확인:

```bash
kubectl get pods -n unbrdn
kubectl get secret -n unbrdn | grep -E "core-jwt|oracle-db|llm-secrets|stt-secrets|tts-secrets|storage-secrets"
kubectl get configmap -n unbrdn | grep -E "core-config|bff-config|socket-config"
kubectl logs deployment/core -n unbrdn --tail=80
kubectl logs deployment/bff -n unbrdn --tail=80
```

**최근 수정 (ConfigMap·배포 순서)**  
- Core: `core-config`에 `datasource-url` 키 추가 (Deployment의 configMapKeyRef와 일치).  
- `deploy-local.sh`: **common → prod** 적용 순서로 변경 (prod ConfigMap 값이 common을 덮어쓰도록).  
수정 반영 후 `kubectl apply -f k8s/apps/core/common/ && kubectl apply -f k8s/apps/core/prod/` 그리고 `kubectl rollout restart deployment/core -n unbrdn` 로 Core만 재적용·재시작할 수 있습니다.

---

## 1. 가능한 원인 요약

| 서비스 | 유력 원인 | 확인 방법 |
|--------|-----------|-----------|
| **core** | ① `postgres-credentials` Secret 없음 ② Postgres/Oracle 불일치 ③ Kafka·Redis 미준비 | `kubectl logs deployment/core -n unbrdn --tail=80` |
| **bff** | ① Core 미기동으로 gRPC/JWKS 연결 실패 ② **local 배포 없음** → prod 이미지(`${IMAGE_REGISTRY}/...`) 사용 ③ `ocir-secret` 필요 | `kubectl logs deployment/bff -n unbrdn --tail=80` |
| **socket** | ① Core 미기동 ② Redis Sentinel(`redis-node-2` 등) 연결 실패 ③ **local 없음** → prod 이미지 | `kubectl logs deployment/socket -n unbrdn --tail=80` |
| **llm** | ① Redis **read-only** 오류(`redis` → replica 연결) ② **local 없음** → prod 이미지 ③ `OPENAI_API_KEY` 등 Secret | `kubectl logs deployment/llm -n unbrdn --tail=80` |
| **stt** | ① Kafka/Redis 연결 실패 ② **local 없음** → prod 이미지 ③ `OPENAI_API_KEY` | `kubectl logs deployment/stt -n unbrdn --tail=80` |
| **storage** | ① **MinIO 미배포** → `minio:9000` 연결 실패 ② Kafka/Redis ③ **local 없음** → prod 이미지 | `kubectl logs deployment/storage -n unbrdn --tail=80` |

---

## 2. 구조적 원인 (설정/배포)

### 2.1 local Deployment 부재 → prod 사용

- **현재**: `bff`, `socket`, `llm`, `stt`, `storage`에는 **`k8s/apps/*/local/`** 가 없어 `deploy-local`이 **prod** 매니페스트를 적용합니다.
- **prod** 배포는 다음을 전제로 합니다.
  - `image: ${IMAGE_REGISTRY}/unbrdn-krn-ocir-*:${IMAGE_TAG}`  
    → **deploy-local은 envsubst 미사용** → 그대로 적용 시 이미지 이름이 `${IMAGE_REGISTRY}/...` 로 남을 수 있음.
  - `imagePullSecrets: ocir-secret`
  - OCI 이미지 레지스트리 접근

**영향**: 로컬에서 `bff:latest` 등 로컬 이미지를 쓰려 해도, prod 배포를 쓰면 레지스트리 이미지를 찾다 실패하거나, 레지스트리 설정에 따라 동작이 달라질 수 있습니다.

### 2.2 Core – Postgres vs Oracle·Secret

- **Core local** (`k8s/apps/core/local/deployment.yaml`) 은 **PostgreSQL** 기준입니다.
  - `SPRING_DATASOURCE_URL`: `jdbc:postgresql://postgres:5432/interview_db`
  - `postgres-credentials` Secret 참조
- **deploy-local** 인프라:
  - `k8s/infra/postgres/local` 이 삭제된 상태라 **Oracle** 경로(`k8s/infra/oracle/`)를 적용.
  - Oracle 배포는 `oracle-db` / `oracle-db-credentials` 를 사용하며, **`postgres-credentials`** 는 만들지 않습니다.

**결과**: Core가 기대하는 **Postgres + postgres-credentials** 가 없으면 `CreateContainerConfigError` 또는 DB 연결 실패로 크래시할 수 있습니다.

### 2.3 Storage – MinIO 미배포

- **storage-config** 에 `OBJECT_STORAGE_ENDPOINT: "http://minio.unbrdn.svc.cluster.local:9000"` 이 있으나,
- **deploy-local** 에서 **MinIO** (`k8s/infra/minio/`) 를 적용하지 않습니다.

**결과**: Storage가 MinIO에 연결하지 못해 기동에 실패할 수 있습니다.

### 2.4 Redis Sentinel – `redis-node-2` 참조

- **socket-config**, **storage-config** 등에서  
  `REDIS_SENTINEL_HOSTS` 에 **redis-node-0, redis-node-1, redis-node-2** 를 지정합니다.
- Redis Helm은 `replica.replicaCount: 2` (마스터 1 + 레플리카 2 = 3노드) 기준이면 `redis-node-0`~`2` 가 있어야 합니다.
- 실제 Pod가 **redis-node-0, redis-node-1** 만 있다면 `redis-node-2` 로의 연결 실패가 발생할 수 있습니다.

### 2.5 Redis read-only (LLM 등)

- ConfigMap 에서 `REDIS_HOST: "redis.unbrdn.svc.cluster.local"` 사용.
- Bitnami Redis Sentinel 구성에서 `redis` 서비스가 **레플리카**를 가리키면 **read-only** 로 인한 쓰기 오류가 발생할 수 있습니다.
- 이전 조치: LLM 등 쓰기하는 쪽은 **redis-master** 를 쓰도록 변경하는 것이 안전합니다.

### 2.6 의존성 순서

- **Core** → Postgres/Oracle, Kafka, Redis  
- **BFF / Socket** → Core (gRPC, JWKS), Kafka, Redis  
- **LLM** → Redis, Kafka  
- **STT / Storage** → Kafka, Redis (Storage는 MinIO 추가)

Core가 CrashLoopBackOff 이면 BFF·Socket 도 연쇄 실패할 수 있습니다.

---

## 3. 로그·이벤트로 확인하기

아래 명령은 **로컬 터미널**에서 실행해야 합니다 (Cursor 샌드박스에서는 `kubectl` 네트워크 접근이 불가할 수 있음).

```bash
# 1. 실패 Pod 이벤트
kubectl get pods -n unbrdn
kubectl describe pod -l app=core    -n unbrdn | tail -30
kubectl describe pod -l app=bff     -n unbrdn | tail -30
kubectl describe pod -l app=socket  -n unbrdn | tail -30

# 2. 앱 로그 (직접 원인 확인)
kubectl logs deployment/core    -n unbrdn --tail=100
kubectl logs deployment/bff     -n unbrdn --tail=100
kubectl logs deployment/socket  -n unbrdn --tail=100
kubectl logs deployment/llm     -n unbrdn --tail=100
kubectl logs deployment/stt     -n unbrdn --tail=100
kubectl logs deployment/storage -n unbrdn --tail=100

# 3. Secret/ConfigMap 존재 여부
kubectl get secret -n unbrdn postgres-credentials,core-jwt-keys,llm-secrets,stt-secrets,tts-secrets,storage-secrets
kubectl get configmap -n unbrdn core-config,bff-config,socket-config,llm-config,storage-config,stt-config

# 4. 인프라 상태
kubectl get pods -n kafka          # Kafka
kubectl get svc -n unbrdn redis,minio,postgres  # Redis, MinIO, Postgres
kubectl get kafka -n kafka         # Strimzi Kafka Ready 여부
```

**통합 진단 스크립트**:

```bash
./scripts/debug.sh unbrdn
# Pod + 리소스까지 보려면:
./scripts/debug.sh unbrdn --resources
```

---

## 4. 권장 조치

1. **로그로 직접 원인 확인**  
   위 `kubectl logs` / `describe` 로 각 서비스의 에러 메시지(DB 연결, Kafka, Redis, MinIO, Secret 부재 등)를 확인합니다.

2. **Core · Postgres 정리**  
   - 로컬에서 **Postgres** 를 쓸 거면:
     - `k8s/infra/postgres/local` 복구 후 deploy-local 이 해당 경로를 적용하도록 유지.
     - `postgres-credentials` Secret 을 deploy-local 또는 수동으로 생성.
   - **Oracle** 만 쓸 거면:
     - Core **local** 배포를 Oracle + `oracle-db-credentials` 기준으로 바꾸고, Postgres 관련 설정 제거.

3. **BFF / Socket / LLM / STT / Storage 에 local Deployment 추가**  
   - `k8s/apps/{bff,socket,llm,stt,storage}/local/deployment.yaml` 에서:
     - `image: <service>:latest`, `imagePullPolicy: IfNotPresent`
     - `imagePullSecrets` 제거
     - `node-pool: main` (Kind 구성에 맞게)
   - deploy-local 이 **local** 우선 적용하도록 이미 되어 있다면, 위 local 추가만으로 prod 대신 로컬 이미지 사용.

4. **MinIO 배포 (Storage 사용 시)**  
   - `kubectl apply -f k8s/infra/minio/`  
   - `minio-credentials` Secret 생성 후, Storage ConfigMap의 `OBJECT_STORAGE_*` 와 맞는지 확인.

5. **Redis**  
   - `redis-node-2` 가 실제로 없으면: Redis replica 수 조정하거나, ConfigMap 의 `REDIS_SENTINEL_HOSTS` 를 실제 존재하는 노드만 쓰도록 수정.
   - LLM 등 쓰기 사용처는 `REDIS_HOST` 를 **redis-master** 로 두는 구성을 권장.

6. **Kafka**  
   - `kubectl get kafka -n kafka`, `kubectl get pods -n kafka` 로 Ready 여부 확인.
   - 미준비 시 Strimzi/Kafka 배포 순서와 리소스(메모리, PVC 등)를 점검.

---

## 5. 참고

- **환경 변수·시크릿**: `docs/environment-variables.md`, `docs/local-secrets-guide.md`
- **배포 스크립트**: `scripts/deploy-local.sh`, `scripts/README.md`
- **기존 장애 분석**: `docs/FAILURE_ANALYSIS.md` (Oracle/프로덕션 등)
