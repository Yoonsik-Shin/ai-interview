# 리소스 산정 및 2 vCPU 8GB×3 노드 가이드

**로컬 Kind / OCI 목표**: 워커 **2 vCPU 8GB × 3** (총 6 vCPU, 24GB). Kafka 3대·Redis 3 Pod 분산, HA 유리.

## 1. 현재 배포 기준 요청량 (requests)

스케줄링은 **requests** 기준으로 이뤄진다. 아래는 `deploy-local` 기준 앱·인프라 합산이다.

### 1.1 애플리케이션 (prod deployment, replicas 2)

| 서비스 | replicas | Memory req | CPU req | 합계 Memory | 합계 CPU |
|--------|----------|------------|---------|-------------|----------|
| BFF | 2 | 512Mi | 200m | 1024Mi | 400m |
| Core | 2 | 1Gi | 200m | 2Gi | 400m |
| LLM | 2 | 1Gi | 200m | 2Gi | 400m |
| Socket | 2 | 512Mi | 150m | 1024Mi | 300m |
| Storage | 2 | 256Mi | 200m | 512Mi | 400m |
| **STT** | **2** | **1Gi** | **1000m** | **2Gi** | **2000m** |
| TTS | 2 | 256Mi | 200m | 512Mi | 400m |
| **소계** | | | | **~9Gi** | **4300m** |

STT(Whisper)가 CPU 요청이 가장 크다 (1 CPU × 2 replicas = 2 vCPU).

### 1.2 인프라

| 구성요소 | replicas | Memory req | CPU req | 합계 Memory | 합계 CPU |
|----------|----------|------------|---------|-------------|----------|
| Redis (Helm local) | 3 | 640Mi/pod (redis+sentinel) | 300m/pod | ~1920Mi | 900m |
| Kafka (local nodepool) | 3 | 1Gi | 200m | 3Gi | 600m |
| Oracle (local) | 1 | 2Gi | 500m | 2Gi | 500m |
| MinIO | 1 | 128Mi (default) | 100m | 128Mi | 100m |
| Strimzi operator | 1 | ~512Mi | ~200m | 512Mi | 200m |
| **소계** | | | | **~7.5Gi** | **2300m** |

### 1.3 모니터링 (k8s/infra/monitoring/common)

| 구성요소 | replicas | Memory req | CPU req | 합계 Memory | 합계 CPU |
|----------|----------|------------|---------|-------------|----------|
| Prometheus | 1 | 256Mi | 50m | 256Mi | 50m |
| Grafana | 1 | 256Mi | 100m | 256Mi | 100m |
| Loki | 1 | 256Mi | 50m | 256Mi | 50m |
| Node-exporter | 3 (DaemonSet) | 32Mi | 50m | 96Mi | 150m |
| Kube-state-metrics | 1 | 64Mi | 50m | 64Mi | 50m |
| Redis exporter (Helm 사이드카) | 3 (Pod당 사이드카) | ~32Mi | ~25m | ~96Mi | ~75m |
| Kafka exporter | 1 | 64Mi | 50m | 64Mi | 50m |
| Promtail | 3 (DaemonSet) | 64Mi | 50m | 192Mi | 150m |
| **소계** | | | | **~1.3Gi** | **~625m** |

### 1.4 합계

| 구분 | Memory requests | CPU requests |
|------|-----------------|--------------|
| 앱 | ~9Gi | 4300m |
| 인프라 | ~7.5Gi | 2300m |
| 모니터링 | ~1.3Gi | ~625m |
| **총합** | **~17.8Gi** | **~7225m** |

---

## 2. 2 vCPU 8GB × 3 노드와 비교

- **노드**: 2 vCPU, 8GB RAM × 3대 (워커) → **6 vCPU, 24 GB** (총)
- **실사용 가능(allocatable)**: 노드당 ~1.8 vCPU, ~7GB (kubelet·시스템 제외)  
  → **~5.4 vCPU, ~21 GB** 가정

| 항목 | 필요량 | 가용량 | 부족 여부 |
|------|--------|--------|-----------|
| **CPU (requests)** | **~7200m (~7.2 vCPU)** | **6000m (6 vCPU)** | ❌ **약 1.2 vCPU 부족** |
| **Memory (requests)** | **~17.7Gi** | **~24Gi** | ✅ 여유 있음 |

**결론**: 현재 설정 그대로면 **2 vCPU 8GB × 3**에서도 **CPU 부족**으로 Pending이 날 수 있다.  
Redis·LLM·STT 등 축소 또는 앱 replicas 조정 시 **6 vCPU 안에서 수용 가능**.

---

## 3. 2 vCPU 8GB×3 노드용 로우 리소스 프로파일 권장

다음 조정으로 **CPU ≈ 3.5 vCPU, Memory ≈ 10Gi** 수준까지 줄이는 것을 권장한다.

### 3.1 변경 요약

| 항목 | 현재 | 로우 리소스 |
|------|------|-------------|
| **앱 replicas** | 2 | **1** |
| **STT CPU request** | 1000m | **500m** (또는 250m) |
| **Kafka replicas** | 3 | **1** |
| **Redis** | 3 (master+2 replica) | **3 유지** (Sentinel quorum), 단 pod당 request 축소 |
| **모니터링** | 전부 배포 | **생략 또는 Prometheus만** (선택) |
| **DB** | Oracle 2Gi, 500m | **유지** (또는 Postgres 512Mi, 250m 사용) |

### 3.2 로우 리소스 적용 후 예상 (대략)

| 구분 | Memory | CPU |
|------|--------|-----|
| 앱 (replicas 1, STT 500m) | ~4.5Gi | ~1750m |
| Redis (3 pod, 소폭 축소) | ~1.2Gi | ~600m |
| Kafka (1 node) | ~1Gi | ~200m |
| DB + MinIO + Strimzi | ~2.6Gi | ~800m |
| 모니터링 생략 시 | 0 | 0 |
| **합계** | **~9.3Gi** | **~3350m** |

이 정도면 **6 vCPU, 24 GB** (2 vCPU 8GB×3) 클러스터에서 **CPU·메모리 둘 다 여유**를 두고 올릴 수 있다.

### 3.3 구현 옵션

1. **앱 replicas 1**  
   - `k8s/apps/*/prod/deployment.yaml`의 `replicas`를 1로 변경하거나,  
   - `k8s/apps/*/local/deployment.yaml`을 두고 `replicas: 1`만 오버라이드.
2. **STT 리소스 축소**  
   - `k8s/apps/stt/prod/deployment.yaml`  
     - `resources.requests.cpu`: `1000m` → `500m` (또는 `250m`)  
     - `resources.requests.memory`: `1Gi` → `512Mi` (필요 시).
3. **Kafka 1노드**  
   - `k8s/infra/kafka/local/kafka-nodepool.yaml`  
     - `replicas`: `3` → `1`  
   - Strimzi/Kafka 동작상 1노드는 개발·테스트 전용으로만 사용.
4. **Redis**  
   - `k8s/infra/redis/helm/local/values.yaml`  
     - `master.resources.requests` / `replica.resources.requests`  
       - memory: `512Mi` → `256Mi`, cpu: `200m` → `100m` 등으로 축소.
5. **모니터링**  
   - `deploy-local`에서 `k8s/infra/monitoring` apply를 건너뛰는 플래그 추가,  
   - 또는 Prometheus만 쓰고 Grafana/Loki 등은 제외.

---

## 4. ResourceQuota / LimitRange

- `k8s/common/resource-management/resource-quota.yaml`:  
  - ✅ **업데이트됨**: `requests.cpu: "6"`, `requests.memory: "24Gi"` (2 vCPU 8GB×3 기준)
  - `limits.cpu: "12"`, `limits.memory: "48Gi"`  
  - 2 vCPU×3 노드(총 6 vCPU, 24GB)에서는 **quota를 6 CPU, 24Gi 이하로 낮추는 것**이 안전하다.  
    그대로 두면 “총 requests < quota”인데 **실제 노드 CPU가 6라서** 스케줄 실패가 나는 구조가 된다.
- LimitRange는 Pod/Container 상한만 두고 있으므로, 로우 리소스 프로파일에서는 그대로 둬도 무방하다.

---

## 5. 요약

- **노드 구성**: **2 vCPU 8GB × 3** 워커 (총 6 vCPU, 24GB). Kind `k8s/kind-cluster-config.yaml` 및 `setup-kind-local.sh` 기준.
- **현재 설정**: requests **~17.7Gi, ~7200m CPU** → **2 vCPU 8GB × 3**으로는 **CPU 부족** 가능.
- **로우 리소스 프로파일**:  
  - 앱 replicas 1, STT·Kafka·Redis·모니터링 축소/생략  
  - 목표 **~9.3Gi, ~3350m**  
- 이렇게 조정하면 **2 vCPU 8GB × 3** 환경에서 **리소스 부족 없이** 올릴 수 있다.
