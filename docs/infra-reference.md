# 인프라 레퍼런스 가이드

> AI 인터뷰 플랫폼 (unbrdn) 인프라 전체 참조 문서
> 최종 업데이트: 2026-03-25

---

## 목차

1. [클러스터 구조](#1-클러스터-구조)
2. [마이크로서비스 목록](#2-마이크로서비스-목록)
3. [인프라 컴포넌트](#3-인프라-컴포넌트)
4. [Redis 3-Track 아키텍처](#4-redis-3-track-아키텍처)
5. [인그레스 & 라우팅](#5-인그레스--라우팅)
6. [시크릿 관리 (ESO)](#6-시크릿-관리-eso)
7. [GPU 워크로드](#7-gpu-워크로드)
8. [데이터 플로우](#8-데이터-플로우)
9. [배포 파이프라인 (GitOps)](#9-배포-파이프라인-gitops)
10. [자주 쓰는 운영 명령어](#10-자주-쓰는-운영-명령어)
11. [트러블슈팅 체크리스트](#11-트러블슈팅-체크리스트)

---

## 1. 클러스터 구조

### AKS 노드풀

| 노드풀 | 노드 수 | VM SKU | 역할 | 라벨 |
|--------|--------|--------|------|------|
| systempool | 1 | Standard_D2as_v5 | 시스템 컴포넌트 | — |
| apppool | 2 | Standard_B2ms | 애플리케이션 서비스 | `role: app` |
| gpupool | 1 | Standard_NC4as_T4_v3 | GPU 추론 (STT/LLM) | `role: inference` |

> gpupool은 Spot VM (deallocate policy). 노드가 선점되면 수동으로 재기동 필요.
> GPU time-slicing: 물리 GPU 1개 → 가상 슬롯 8개 (`nvidia.com/gpu`)

### 네임스페이스

| 네임스페이스 | 용도 |
|------------|------|
| `unbrdn` | 모든 애플리케이션 서비스 |
| `kafka` | Strimzi Kafka 클러스터 |
| `argocd` | GitOps 컨트롤러 |
| `ingress-nginx` | NGINX Ingress Controller |
| `cert-manager` | TLS 인증서 자동 관리 |
| `external-secrets` | Azure Key Vault ESO |
| `kube-system` | NVIDIA Device Plugin 등 시스템 |
| `monitoring` | Prometheus, Grafana, Loki |

---

## 2. 마이크로서비스 목록

모든 서비스는 `unbrdn` 네임스페이스에 배포.
이미지 레지스트리: `unbrdnacr.azurecr.io`

### API Gateway / 클라이언트 facing

| 서비스 | 포트 | 기술 | 레플리카 | 역할 |
|--------|------|------|---------|------|
| **bff** | 3000 (HTTP) | Node.js/NestJS | 2 | REST API Gateway, 인증 미들웨어, 클라이언트 요청 집합 |
| **socket** | 4000 (HTTP/WS) | Node.js/NestJS | 2 | WebSocket/Socket.IO, 실시간 오디오·스트리밍 |

### 도메인 서비스 (Spring Boot)

| 서비스 | 포트 | 레플리카 | 역할 |
|--------|------|---------|------|
| **interview** | 8081 (HTTP), 9090 (metrics) | 1 | 인터뷰 세션 오케스트레이터, 상태 머신, LLM 협력 |
| **resume** | 8081 (HTTP), 9090 (metrics) | 1 | 이력서 벡터 저장, RAG 검색 |
| **auth** | 8081 (HTTP), 9090 (metrics) | 1 | 사용자 인증, JWT 발급·검증 |
| **payment** | 8081 (HTTP), 9090 (metrics) | 1 | 결제 처리, 빌링 |

### AI 인프라 서비스 (Python)

| 서비스 | 포트 | 레플리카 | GPU | 역할 |
|--------|------|---------|-----|------|
| **llm** | 50051 (gRPC) | 2 | — | LangGraph AI 에이전트, 동적 페르소나, 컨텍스트 관리 |
| **stt** | 50052 (gRPC) | 2 | 1개 | Whisper 실시간 음성 인식 |
| **tts** | 50053 (gRPC) | 2 | — | 텍스트→음성 합성 |
| **storage** | 8000 (HTTP) | 2 | — | Azure Blob 업로드, 인터뷰 아카이브, Redis 큐 워커 |
| **document** | 8100 (HTTP) | 1 | 1개 | 문서 처리·분석 |

### 관리 UI

| 서비스 | 포트 | 역할 |
|--------|------|------|
| **kafka-ui** | 8080 (HTTP) | Kafka 클러스터 모니터링 (`/admin` 경로, LOGIN_FORM 인증) |

---

## 3. 인프라 컴포넌트

### PostgreSQL (Azure Flexible Server)

- **호스트**: `unbrdn-postgres.postgres.database.azure.com`
- **버전**: PostgreSQL 15
- **SKU**: GP_Standard_D2s_v3, 스토리지 32GB
- **K8s 연결**: `postgres` ExternalName Service (포트 5432)
- **스키마**: `auth`, `interview`, `resume`, `payment`
- **Credentials**: `postgres-credentials` Secret (ESO → Key Vault)

### MongoDB

- **배포**: unbrdn 네임스페이스 내 `mongo` Deployment
- **포트**: 27017
- **Credentials**: `mongo-secret` (ESO → Key Vault: `mongo-root-username`, `mongo-root-password`)
- **사용 서비스**: interview (유연한 도큐먼트 저장)
- **URI**: Key Vault `mongo-uri` (URL 인코딩 주의: `*` → `%2A`)

### Kafka (Strimzi, KRaft 모드)

- **네임스페이스**: kafka
- **버전**: Strimzi 4.1.1
- **브로커**: 3개 (min.insync.replicas: 2)
- **연결**: `kafka-cluster-kafka-bootstrap.kafka.svc.cluster.local:9092`
- **주요 토픽**:

| 토픽 | 프로듀서 | 컨슈머 |
|------|--------|--------|
| `interview.audio.input` | socket | stt |
| `BotQuestion` | interview (Core) | tts |
| `storage.completed` | storage | interview (Core) |
| `interview.started` | interview | — |
| `interview.completed` | interview | — |

### Azure Blob Storage

- **Account**: `unbrdnstorage`
- **Container**: `unbrdn-blob`
- **Connection String**: Key Vault `storage-connection-string` → storage-secrets Secret

### ArgoCD

- **네임스페이스**: argocd
- **접근 URL**: `https://argocd.unbrdn.me`
- **이전**: LoadBalancer (공개 IP 노출) → **현재**: ClusterIP + Ingress (보안 강화)
- **운영 가이드**: [docs/argocd_operations.md](argocd_operations.md)

---

## 4. Redis 3-Track 아키텍처

> 상세 분석: [docs/redis_3track_analysis.md](redis_3track_analysis.md)

### Track 1 — 실시간 UI 레이어

| 항목 | 값 |
|------|---|
| 배포 방식 | Bitnami Helm Chart, Sentinel HA |
| 구성 | Master 1 + Replica 3 + Sentinel |
| 영속성 | **없음** (`appendonly: no`) — 재시작 시 데이터 소실 |
| 메모리 정책 | `noeviction` (TTL 필수) |
| K8s Service | `redis-track1.unbrdn.svc.cluster.local:6379` |
| Sentinel | `redis-track1-node-{0,1,2}.redis-track1-headless.unbrdn.svc.cluster.local:26379` |
| Sentinel Name | `mymaster` |
| Credentials | `redis-track1-credentials` Secret (ESO → Key Vault: `redis-track1-password`) |
| 사용 서비스 | stt, llm, tts, interview, socket, storage, bff, auth, resume, payment |

**주요 키 패턴:**
- `interview:stt:pubsub:{interview_id}` — STT 결과 브로드캐스트 (Pub/Sub)
- `interview:llm:pubsub:{interview_id}` — LLM 토큰 스트리밍 (Pub/Sub)
- `interview:llm:buffer:{interview_id}` — 토큰 누적 버퍼
- `socket:connection:user:{user_id}` — WebSocket 세션 정보
- `interview:audio:{queue_id}` — 오디오 처리 큐

### Track 2 — LLM 체크포인트 메모리

| 항목 | 값 |
|------|---|
| 배포 방식 | Bitnami Helm Chart, Standalone |
| 구성 | Master 1 (replica 없음) |
| 영속성 | **있음** (`appendonly: yes`, PVC 8Gi) |
| 메모리 정책 | `volatile-lru` |
| K8s Service | `redis-track2.unbrdn.svc.cluster.local:6379` |
| 사용 서비스 | llm (전용) |

**주요 키 패턴:**
- `langgraph:checkpoint:hash:{session_id}` — LangGraph 전체 대화 히스토리 + 그래프 상태

### Track 3 — 비즈니스 상태 & 큐

| 항목 | 값 |
|------|---|
| 배포 방식 | Azure Cache for Redis (관리형) |
| SKU | Standard, Capacity 1 |
| 영속성 | Azure 표준 영속성 |
| Credentials | `interview-redis-track3-secret` (ESO) |
| 사용 서비스 | interview |

**주요 키 패턴:**
- `interview:{id}:state` — 세션 메타데이터 (Hash)
- `interview:sentence:stream` — 문장 스트리밍 큐 (Redis Streams)

---

## 5. 인그레스 & 라우팅

### 도메인: `unbrdn.me`

**TLS**: cert-manager + Let's Encrypt Production (자동 갱신)
**Ingress Controller**: NGINX (ingress-nginx 네임스페이스)
**External IP**: `20.196.252.64`

#### 메인 인그레스 (`main-ingress`, namespace: `unbrdn`)

| 경로 | 서비스 | 포트 | 비고 |
|------|--------|------|------|
| `/api` | bff | 3000 | REST API |
| `/socket.io/` | socket | 4000 | WebSocket (업그레이드 헤더, 3600s 타임아웃) |
| `/admin` | kafka-ui | 8080 | Kafka 관리 UI (LOGIN_FORM 인증) |

> Frontend: Azure Static Web App으로 별도 배포 (인그레스 불필요)

#### ArgoCD 인그레스 (`argocd-ingress`, namespace: `argocd`)

| 호스트 | 서비스 | 포트 | 비고 |
|--------|--------|------|------|
| `argocd.unbrdn.me` | argocd-server | 443 | HTTPS 백엔드 프로토콜 |

### DNS (Azure DNS Zone, Terraform 관리)

| 레코드 | 타입 | 값 |
|--------|------|---|
| `@` (unbrdn.me) | A | `20.196.252.64` (Ingress IP) |
| `www` | A | `20.196.252.64` |
| `argocd` | A | `20.196.252.64` |

**Terraform 파일**: `terraform/dns.tf`
**NS 서버**: Azure DNS가 관리 (Gabia에서 NS 레코드 위임 완료)

---

## 6. 시크릿 관리 (ESO)

### 흐름

```
Azure Key Vault
      ↓ (ESO ClusterSecretStore: azure-keyvault-store)
ExternalSecret (k8s 리소스)
      ↓ (refreshInterval: 1h)
Kubernetes Secret
      ↓
Deployment env (secretKeyRef / secretRef)
```

### ClusterSecretStore

```yaml
# k8s/infra/external-secrets/cluster-secret-store.yaml
name: azure-keyvault-store
vault: unbrdn-keyvault (Korea Central)
```

### 주요 Secret 목록

| K8s Secret 이름 | 포함 키 | Key Vault 원본 | 네임스페이스 |
|----------------|---------|--------------|------------|
| `redis-track1-credentials` | `password` | `redis-track1-password` | unbrdn |
| `postgres-credentials` | `username`, `password` | `postgres-username`, `postgres-password` | unbrdn |
| `mongo-secret` | `mongo-root-username`, `mongo-root-password` | `mongo-root-username`, `mongo-root-password` | unbrdn |
| `storage-secrets` | `AZURE_STORAGE_CONNECTION_STRING`, `MONGODB_URI` | `storage-connection-string`, `mongo-uri` | unbrdn |
| `kafka-ui-credentials` | `username`, `password` | `kafka-ui-username`, `kafka-ui-password` | unbrdn |
| `interview-jwt-keys` | JWT 키쌍 | — | unbrdn |
| `interview-redis-track3-secret` | Track3 연결 정보 | — | unbrdn |
| `llm-secrets` | OpenAI 키 등 | — | unbrdn |

### Key Vault에 시크릿 등록 예시

```bash
az keyvault secret set \
  --vault-name unbrdn-keyvault \
  --name <secret-name> \
  --value "<value>"
```

### ESO 강제 동기화

```bash
# ExternalSecret을 강제로 재동기화 (Key Vault 값 변경 후)
kubectl annotate externalsecret <name> -n unbrdn \
  force-sync=$(date +%s) --overwrite
```

---

## 7. GPU 워크로드

### NVIDIA Device Plugin (time-slicing)

- **DaemonSet**: `nvidia-device-plugin-ds` (kube-system)
- **ConfigMap**: `k8s/infra/nvidia/prod/time-slicing-config.yaml`
- **설정**: `nvidia.com/gpu` → 8 가상 슬롯

```yaml
# 핵심 설정 형식 (올바른 형식)
sharing:
  timeSlicing:
    resources:
      - name: nvidia.com/gpu
        replicas: 8
```

> ⚠️ `resources` 키가 없으면 Device Plugin이 파싱 실패 → `nvidia.com/gpu` 미등록 → GPU 파드 Pending

### GPU 사용 서비스

| 서비스 | GPU 요청량 | 노드 배치 |
|--------|-----------|--------|
| stt | 1 (`nvidia.com/gpu`) | gpupool (`role: inference`) |
| document | 1 (`nvidia.com/gpu`) | gpupool (`role: inference`) |

### GPU 트러블슈팅

```bash
# GPU 슬롯 확인
kubectl get nodes -o json | jq '.items[].status.allocatable["nvidia.com/gpu"]'

# Device Plugin 로그
kubectl logs -n kube-system -l name=nvidia-device-plugin-ds

# GPU 파드 Pending 원인
kubectl describe pod <pod-name> -n unbrdn | grep -A5 "Events:"
```

**Rolling update 데드락 방지**: GPU 슬롯 8개 유지 → document(1) + stt(2) = 3개 사용, 롤링 업데이트 시 여유 슬롯 확보

---

## 8. 데이터 플로우

### 인터뷰 실시간 스트리밍

```
사용자 음성
    ↓ (WebSocket/Socket.IO)
socket 서비스 (포트 4000)
    ↓ (Kafka: interview.audio.input)
stt 서비스 (gRPC 50052, GPU)
    ↓ (Redis Track1 Pub/Sub: interview:stt:pubsub:{id})
interview 서비스 (Subscriber)
    ↓ (gRPC 50051)
llm 서비스 (LangGraph)
    │   ↓ (Redis Track2: LangGraph checkpoint 저장)
    ↓ (토큰 스트리밍)
Redis Track1 (interview:llm:buffer:{id} APPEND)
    ↓ (문장 완성 감지: . ? !)
Redis Track3 Stream (interview:sentence:stream XADD)
    ├─→ [Consumer A] tts 서비스 → 음성 합성 → socket → 사용자
    └─→ [Consumer B] DB Worker → PostgreSQL INSERT
```

### 인터뷰 완료 후 아카이브

```
interview 서비스
    ↓ (Kafka: interview.completed)
storage 서비스
    ↓
Azure Blob Storage (unbrdn-blob)
    ↓ (Kafka: storage.completed)
interview 서비스 (URL 업데이트)
```

---

## 9. 배포 파이프라인 (GitOps)

### 흐름

```
개발자 코드 Push
    ↓
GitHub Actions
    ├─ 컨테이너 빌드
    ├─ ACR 푸시 (unbrdnacr.azurecr.io/<service>:<sha>)
    └─ k8s/apps/<service>/prod/deployment.yaml 이미지 태그 업데이트 + git push
         ↓
ArgoCD (auto-sync, prune, selfHeal)
    └─ AKS 클러스터 상태를 Git 상태로 수렴
```

### ArgoCD 접근

- **URL**: `https://argocd.unbrdn.me`
- **이전 방식**: `kubectl port-forward svc/argocd-server -n argocd 8080:443`

### 수동 sync

```bash
# ArgoCD CLI
argocd app sync <app-name>

# 또는 웹 UI에서 [SYNC] 버튼
```

### 이미지 태그 수동 업데이트 (긴급 배포)

```bash
# deployment.yaml의 image 태그를 직접 수정 후 push → ArgoCD가 자동 감지
```

---

## 10. 자주 쓰는 운영 명령어

### Pod 상태 확인

```bash
# 전체 파드
kubectl get pods -n unbrdn

# 특정 서비스 로그 (최근 100줄)
kubectl logs -n unbrdn deploy/<service> --tail=100

# 실시간 로그
kubectl logs -n unbrdn deploy/<service> -f

# 파드 재시작 (롤링)
kubectl rollout restart deploy/<service> -n unbrdn
```

### ArgoCD 앱 상태

```bash
kubectl get applications -n argocd
```

### ESO Secret 확인

```bash
# ExternalSecret 동기화 상태
kubectl get externalsecrets -n unbrdn

# Secret 내용 (base64 디코딩)
kubectl get secret <secret-name> -n unbrdn -o jsonpath='{.data.<key>}' | base64 -d
```

### Redis 연결 테스트

```bash
# Track1 Sentinel에 연결
kubectl exec -n unbrdn deploy/interview -- \
  redis-cli -h redis-track1.unbrdn.svc.cluster.local -p 6379 \
  -a <password> ping
```

### Kafka 토픽 확인

```bash
# kafka-ui: https://unbrdn.me/admin

# 또는 CLI
kubectl exec -n kafka kafka-cluster-kafka-0 -- \
  kafka-topics.sh --bootstrap-server localhost:9092 --list
```

### PostgreSQL 접속

```bash
kubectl exec -n unbrdn deploy/interview -- \
  sh -c "PGPASSWORD=<password> psql -h postgres -U <username> -d postgres -c '\l'"
```

### GPU 상태

```bash
# 노드별 GPU 할당 현황
kubectl describe nodes | grep -A5 "nvidia.com/gpu"

# GPU 파드 목록
kubectl get pods -n unbrdn -o wide | grep -E "stt|document"
```

### TLS 인증서 상태

```bash
kubectl get certificate -n unbrdn
kubectl get certificate -n argocd
kubectl describe certificate tls-secret -n unbrdn
```

---

## 11. 트러블슈팅 체크리스트

### CrashLoopBackOff

```bash
kubectl describe pod <pod> -n unbrdn   # Events 섹션 확인
kubectl logs <pod> -n unbrdn --previous  # 이전 컨테이너 로그
```

**일반적인 원인:**

| 증상 | 원인 | 해결 |
|------|------|------|
| `NOAUTH HELLO must be called with authenticated client` | Redis 비밀번호 미설정 | `SPRING_DATA_REDIS_PASSWORD` + `SPRING_DATA_REDIS_SENTINEL_PASSWORD` 모두 secretKeyRef 추가 |
| `Authentication required` (Redis) | 서비스별 REDIS_PASSWORD env 누락 | deployment.yaml에 secretKeyRef 추가 |
| `Permission denied /.cache/uv` | `runAsUser: 1000`으로 uv 캐시 접근 불가 | storage 서비스는 `runAsUser` 제거 |
| `Insufficient nvidia.com/gpu` | Device Plugin 미작동 또는 슬롯 부족 | time-slicing-config `resources` 키 확인, DaemonSet 재시작 |
| MongoDB `Unauthorized` | 인증 DB 미설정 | `SPRING_DATA_MONGODB_AUTHENTICATION_DATABASE: admin` 추가 |
| `ImagePullBackOff` | ACR 인증 실패 | `acr-secret` imagePullSecrets 확인 |

### Pod Pending (Scheduling 실패)

```bash
kubectl describe pod <pod> -n unbrdn  # "Insufficient ..." 메시지 확인
```

- **GPU Pending**: `nvidia.com/gpu` 부족 → time-slicing 슬롯 수 확인
- **메모리 Pending**: apppool 노드 메모리 확인 → 스케일 업 검토
- **NodeAffinity**: `role: inference` 라벨 노드가 없으면 GPU 파드 Pending

### Redis Rolling Update 데드락

증상: 새 파드가 GPU 슬롯 대기 중인데 구 파드가 슬롯 점유 중

```bash
# 구 ReplicaSet 스케일 0으로 강제 축소
kubectl get rs -n unbrdn | grep <service>
kubectl scale rs <old-rs-name> -n unbrdn --replicas=0
```

### ArgoCD Sync 실패

```bash
kubectl get events -n argocd --sort-by='.lastTimestamp'
# ApplicationSet 이름 충돌 → app 이름 변경 필요
```

### cert-manager TLS 발급 실패

```bash
kubectl describe certificate tls-secret -n unbrdn
kubectl get challenges -n unbrdn  # HTTP-01 챌린지 상태
# DNS 전파 완료 여부: dig unbrdn.me A
```

---

## 관련 문서

| 문서 | 설명 |
|------|------|
| [argocd_operations.md](argocd_operations.md) | ArgoCD 운영 및 동기화 가이드 |
| [redis_3track_analysis.md](redis_3track_analysis.md) | Redis 3-Track 상세 분석 |
| [architecture_big_picture.md](architecture_big_picture.md) | 전체 아키텍처 다이어그램 |
| [current_architecture_analysis.md](current_architecture_analysis.md) | 현재 아키텍처 분석 |
| [guide/kafka-topics.md](guide/kafka-topics.md) | Kafka 토픽 상세 |
