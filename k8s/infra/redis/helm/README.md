# Redis Helm Chart 배포 가이드

## 개요

이 디렉토리는 **Bitnami Redis Helm Chart**를 사용하여 Redis Sentinel을 배포합니다.

기존 순수 K8s 매니페스트 대신 Helm Chart를 사용하여:
- ✅ 운영 부담 감소 (자동 Failover, 검증된 패턴)
- ✅ 업스트림 패치 자동 반영
- ✅ 업그레이드/롤백 용이

## 구조

```
k8s/infra/redis/helm/
└── values.yaml      # 로컬(Kind) 및 프로덕션(OCI OKE) 공통 설정
```

## 배포 방법

### 로컬 및 프로덕션 (공통)

```bash
# Bitnami Repository 추가 (최초 1회)
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# 배포
helm install redis bitnami/redis \
  --namespace unbrdn \
  --create-namespace \
  --values k8s/infra/redis/helm/values.yaml \
  --wait \
  --timeout 5m

# 업그레이드
helm upgrade redis bitnami/redis \
  --namespace unbrdn \
  --values k8s/infra/redis/helm/values.yaml \
  --wait \
  --timeout 5m
```

## 주요 설정

### Sentinel 모드

- **3개 Pod**: Master 1 + Replicas 2 (로컬/프로덕션 동일)
- **Sentinel**: 각 Pod에 사이드카로 실행
- **Quorum**: 2 (3개 중 2개 동의 필요)

### Service 이름

- `fullnameOverride: redis`로 설정하여 기존 `redis` 서비스 이름과 호환
- Headless Service: `redis-headless` (StatefulSet용)

### 리소스

- **Master**: 512Mi-1Gi, 200m-500m CPU
- **Replica**: 512Mi-1Gi, 200m-500m CPU
- **Sentinel**: 128Mi-256Mi, 100m-200m CPU

### 영속성

- **StorageClass**: 미지정 (클러스터 default 사용. 로컬: local-path)
- **Size**: 10Gi per Pod

### 메트릭

- **metrics.enabled: true**: 각 Redis Pod에 exporter 사이드카 자동 추가
- **Prometheus 스크랩**: `redis-metrics` Service를 통해 자동 발견 (kubernetes_sd_configs)
- **리소스**: Pod당 약 32Mi, 25m CPU (3개 Pod = 96Mi, 75m CPU)
- **관리**: Helm Chart가 자동 관리, Redis 업그레이드 시 exporter도 자동 업데이트

### Pod 라벨

Helm Chart는 다음 라벨을 사용합니다:

- `app.kubernetes.io/name: redis`
- `app.kubernetes.io/component: master|replica|sentinel`

기존 `app: redis` 라벨과는 다르므로, 애플리케이션에서 Service를 통해 접근하는 경우 영향 없음.

## 상태 확인

```bash
# Helm Release 상태
helm status redis -n unbrdn

# Pod 상태
kubectl get pods -n unbrdn -l app.kubernetes.io/name=redis

# Service 확인
kubectl get svc -n unbrdn -l app.kubernetes.io/name=redis

# Sentinel 상태
kubectl exec -it redis-node-0 -n unbrdn -c sentinel -- redis-cli -p 26379 SENTINEL masters
```

## 업그레이드

```bash
# Chart 업데이트
helm repo update

# Release 업그레이드
helm upgrade redis bitnami/redis \
  --namespace unbrdn \
  --values k8s/infra/redis/helm/values.yaml \
  --wait \
  --timeout 5m
```

## 롤백

```bash
# 이전 버전으로 롤백
helm rollback redis -n unbrdn

# 특정 revision으로 롤백
helm rollback redis <revision> -n unbrdn
```

## 삭제

```bash
# Helm Release 삭제 (PVC는 유지)
helm uninstall redis -n unbrdn

# PVC까지 삭제하려면
kubectl delete pvc -n unbrdn -l app.kubernetes.io/name=redis
```
