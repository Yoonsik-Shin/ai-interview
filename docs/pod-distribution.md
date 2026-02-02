# 파드 분산 메커니즘 가이드

## 개요

Kubernetes에서 파드가 노드에 배치되는 방식은 **여러 레이어의 스케줄링 규칙**이 조합되어 결정됩니다. 이 문서는 현재 프로젝트에서 파드가 어떻게 분산되는지 설명합니다.

---

## 1. 스케줄링 우선순위 (위에서 아래로)

### 1.1 필수 조건 (Hard Constraints)
다음 조건을 만족하지 않으면 **스케줄링 실패** (Pending 상태):

1. **리소스 가용성** (`resources.requests`)
   - 노드의 **allocatable** 리소스(CPU/메모리)가 파드의 `requests` 이상이어야 함
   - 예: 파드가 `cpu: 500m` 요청 → 노드에 500m 이상 여유 필요

2. **nodeAffinity (required)**
   - `requiredDuringSchedulingIgnoredDuringExecution`
   - 예: `node-pool: main` 라벨이 있는 노드만 선택

3. **Taint/Toleration**
   - 노드에 `taint`가 있으면 파드에 `toleration` 필요
   - 현재: Preemptible taint 제거됨 (모든 워커 동일)

### 1.2 선호 조건 (Soft Constraints)
다음 조건을 만족하면 **우선순위가 높아짐** (만족 못해도 스케줄링 가능):

1. **topologySpreadConstraints** (최신 방식, 균등 분산)
2. **podAntiAffinity (preferred)**
3. **nodeAffinity (preferred)**

---

## 2. 현재 프로젝트의 분산 전략

### 2.1 Kafka (3 replicas)

**설정**: `k8s/infra/kafka/local/kafka-nodepool.yaml`

```yaml
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
              - key: strimzi.io/cluster
                operator: In
                values: [kafka-cluster]
          topologyKey: "kubernetes.io/hostname"
```

**동작**:
- **목표**: 3개 브로커가 서로 다른 노드에 배치
- **방식**: `preferred` (강제 아님) → 노드 부족 시 같은 노드에 배치 가능
- **결과**: 
  - 이상적: Node1, Node2, Node3에 각각 1개씩
  - 노드 부족 시: Node1에 2개, Node2에 1개 (또는 다른 조합)

**예시 시나리오**:
```
초기 배포 (3 노드):
  Node1: kafka-broker-0
  Node2: kafka-broker-1
  Node3: kafka-broker-2

replicas 3 → 5로 증가:
  Node1: kafka-broker-0, kafka-broker-3
  Node2: kafka-broker-1, kafka-broker-4
  Node3: kafka-broker-2
  (균등 분산 시도, maxSkew 없으면 완벽하지 않을 수 있음)
```

---

### 2.2 Redis (3 Pods: Master + 2 Replica)

**설정**: `k8s/infra/redis/helm/prod/values.yaml`

**Master**:
```yaml
affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:  # 강제
      - labelSelector:
          matchExpressions:
            - key: app.kubernetes.io/component
              operator: In
              values: [master]
        topologyKey: "kubernetes.io/hostname"
```

**Replica**:
```yaml
affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:  # 강제
      - labelSelector:
          matchExpressions:
            - key: app.kubernetes.io/component
              operator: In
              values: [replica]
        topologyKey: "kubernetes.io/hostname"
```

**동작**:
- **Master**: 다른 Master와 같은 노드 불가 (required)
- **Replica**: 다른 Replica와 같은 노드 불가 (required)
- **결과**: Master 1개 + Replica 2개 = 3개가 서로 다른 노드에 배치

**예시 시나리오**:
```
초기 배포:
  Node1: redis-master-0
  Node2: redis-replica-0
  Node3: redis-replica-1

replicas 2 → 3으로 증가:
  Node1: redis-master-0
  Node2: redis-replica-0
  Node3: redis-replica-1, redis-replica-2  # required 위반 가능?
  → 실제로는: Node1, Node2, Node3에 각각 1개씩 (required이므로)
```

---

### 2.3 애플리케이션 (BFF, Core, LLM, Socket 등)

**설정**: `k8s/apps/*/prod/deployment.yaml`

**공통 패턴**:
```yaml
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: ScheduleAnyway
    labelSelector:
      matchLabels:
        app: bff

affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app: bff
          topologyKey: kubernetes.io/hostname
```

**동작**:
- **topologySpreadConstraints**: 노드 간 파드 수 차이를 최대 1개로 제한
- **podAntiAffinity (preferred)**: 같은 서비스 파드끼리 다른 노드 선호
- **결과**: 균등 분산

**예시 시나리오 (BFF replicas: 2 → 4)**:
```
초기 (2 replicas):
  Node1: bff-0
  Node2: bff-1

replicas 2 → 4로 증가:
  Node1: bff-0, bff-2
  Node2: bff-1, bff-3
  (maxSkew=1 유지: 각 노드 2개씩)

replicas 4 → 6으로 증가:
  Node1: bff-0, bff-2, bff-4
  Node2: bff-1, bff-3, bff-5
  Node3: (없음)
  → maxSkew=1 위반 (3 vs 0)
  → whenUnsatisfiable: ScheduleAnyway이므로 스케줄링은 성공하지만, 가능하면 Node3에도 배치 시도
```

---

## 3. 스케줄링 프로세스 (단계별)

### 3.1 필터링 (Filtering)
스케줄러가 **모든 노드**를 검사하여 다음 조건을 만족하는 노드만 후보로 선정:

1. ✅ 리소스 여유 (`requests` 충족)
2. ✅ nodeAffinity (required) 만족
3. ✅ Taint/Toleration 만족
4. ✅ podAntiAffinity (required) 만족

**결과**: 후보 노드 리스트 (예: Node1, Node2, Node3)

### 3.2 점수 계산 (Scoring)
후보 노드들에 대해 **점수**를 계산 (높을수록 우선):

1. **topologySpreadConstraints 점수**
   - 노드 간 파드 수 차이(`skew`)가 작을수록 높은 점수
   - 예: Node1(2개), Node2(1개) → Node2에 배치 시 skew=0 → 높은 점수

2. **podAntiAffinity (preferred) 점수**
   - 같은 서비스 파드가 없는 노드에 높은 점수
   - 예: Node1에 bff-0 있음 → Node2에 bff-1 배치 시 높은 점수

3. **nodeAffinity (preferred) 점수**
   - 선호하는 라벨이 있는 노드에 높은 점수

4. **리소스 점수**
   - 리소스 여유가 많을수록 높은 점수 (균등 분산)

### 3.3 선택 (Selection)
가장 높은 점수의 노드에 파드 배치

---

## 4. 실제 분산 예시 (2 vCPU 8GB × 3 노드)

### 4.1 초기 배포 (replicas: 기본값)

**인프라**:
- Kafka: 3 (Node1, Node2, Node3에 각각 1개)
- Redis: 3 (Master Node1, Replica Node2, Replica Node3)

**애플리케이션 (각 replicas: 2)**:
- BFF: 2 → Node1, Node2 (또는 Node2, Node3)
- Core: 2 → Node1, Node3 (또는 다른 조합)
- LLM: 2 → Node2, Node3 (또는 다른 조합)
- Socket: 2 → Node1, Node2 (또는 다른 조합)

**결과**: 각 노드에 여러 파드가 섞여 배치됨

### 4.2 스케일 아웃 (replicas 증가)

**BFF: 2 → 4로 증가**:
```
Before:
  Node1: bff-0
  Node2: bff-1

After:
  Node1: bff-0, bff-2
  Node2: bff-1, bff-3
  (maxSkew=1 유지: 각 노드 2개씩)
```

**BFF: 4 → 6으로 증가**:
```
Before:
  Node1: bff-0, bff-2
  Node2: bff-1, bff-3

After (이상적):
  Node1: bff-0, bff-2, bff-4
  Node2: bff-1, bff-3, bff-5
  Node3: (없음)
  → maxSkew=2 (3 vs 0) → 위반이지만 ScheduleAnyway이므로 배치됨

실제 (다른 서비스와 섞임):
  Node1: bff-0, bff-2, bff-4, core-0, kafka-broker-0
  Node2: bff-1, bff-3, bff-5, core-1, kafka-broker-1
  Node3: socket-0, socket-1, kafka-broker-2
  → 리소스 여유에 따라 분산
```

---

## 5. 제약 사항

### 5.1 리소스 부족
- 노드의 **allocatable** 리소스가 부족하면 Pending 상태
- 예: Node1에 CPU 200m 여유, 파드가 500m 요청 → 스케줄링 실패

### 5.2 nodeAffinity (required)
- `node-pool: main` 라벨이 없는 노드에는 배치 불가
- 현재: 모든 워커가 `node-pool: main`이므로 문제 없음

### 5.3 podAntiAffinity (required)
- Redis Master/Replica는 같은 노드에 배치 불가
- 노드가 3개 미만이면 일부 파드가 Pending 상태

### 5.4 ResourceQuota
- 네임스페이스 전체 리소스 제한
- 현재: `requests.cpu: "8"`, `requests.memory: "16Gi"`
- 2 vCPU 8GB × 3 = 6 vCPU, 24GB → Quota가 더 크므로 문제 없음

---

## 6. 모니터링

### 6.1 파드 분산 확인

```bash
# 노드별 파드 수 확인
kubectl get pods -n unbrdn -o wide | awk '{print $7}' | sort | uniq -c

# 특정 서비스 파드 분산 확인
kubectl get pods -n unbrdn -l app=bff -o wide

# 노드별 리소스 사용량
kubectl top nodes
```

### 6.2 스케줄링 이벤트 확인

```bash
# Pending 파드의 스케줄링 실패 이유
kubectl describe pod <pod-name> -n unbrdn | grep -A 10 Events

# 스케줄러 로그 (Control Plane)
kubectl logs -n kube-system -l component=kube-scheduler
```

---

## 7. 요약

| 메커니즘 | 우선순위 | 동작 | 예시 |
|---------|---------|------|------|
| **리소스 (requests)** | 필수 | 노드 allocatable ≥ 파드 requests | CPU 500m 요청 → 500m 이상 여유 필요 |
| **nodeAffinity (required)** | 필수 | 특정 노드 풀만 선택 | `node-pool: main` |
| **podAntiAffinity (required)** | 필수 | 같은 서비스 파드 분리 강제 | Redis Master/Replica |
| **topologySpreadConstraints** | 선호 | 노드 간 균등 분산 (maxSkew 제한) | BFF 4개 → 노드당 2개씩 |
| **podAntiAffinity (preferred)** | 선호 | 같은 서비스 파드 분리 선호 | Kafka 브로커 |
| **nodeAffinity (preferred)** | 선호 | 특정 노드 풀 선호 | `node-pool: application` |

**결론**: 파드가 늘어나면 **topologySpreadConstraints**와 **podAntiAffinity (preferred)**에 의해 **가능한 한 균등하게 분산**되며, 리소스 여유가 있는 노드에 우선 배치됩니다.
