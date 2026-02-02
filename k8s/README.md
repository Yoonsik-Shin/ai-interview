# Kubernetes 매니페스트 구조

이 디렉토리는 **폴더 기반 환경 구분** 방식으로 구성되어 있습니다.

## 📂 디렉토리 구조

```
k8s/
├── apps/                    # 애플리케이션 서비스
│   ├── bff/
│   │   ├── local/          # 로컬 환경 전용 설정
│   │   │   └── deployment.yaml
│   │   ├── prod/           # 프로덕션 환경 전용 설정
│   │   │   ├── deployment.yaml
│   │   │   └── configmap.yaml
│   │   └── common/         # 환경 무관 공통 설정
│   │       └── service.yaml
│   ├── core/
│   │   ├── local/
│   │   ├── prod/
│   │   └── common/
│   ├── inference/
│   │   ├── local/
│   │   ├── prod/
│   │   └── common/
│   └── socket/
│       ├── local/
│       ├── prod/
│       └── common/
├── infra/                   # 인프라 리소스
│   ├── kafka/
│   │   ├── local/
│   │   │   ├── kafka-nodepool.yaml
│   │   │   ├── kafka.yaml
│   │   │   ├── kafka-ui-deployment.yaml
│   │   │   ├── kafka-ui-service.yaml
│   │   │   ├── kafka-ui-externalname.yaml
│   │   │   └── strimzi-operator-install.yaml
│   │   └── prod/
│   │       ├── kafka-nodepool.yaml
│   │       ├── kafka.yaml
│   │       ├── kafka-configmap.yaml
│   │       └── strimzi-operator-install.yaml
│   ├── postgres/
│   │   └── local/          # PostgreSQL은 로컬 전용
│   │       ├── deployment.yaml
│   │       ├── service.yaml
│   │       ├── pvc.yaml
│   │       ├── secret.yaml
│   │       └── configmap.yaml
│   ├── redis/
│   │   ├── local/
│   │   ├── prod/
│   │   └── common/
│   └── cert-manager/
│       ├── local/
│       │   ├── self-signed-cert.yaml
│       │   └── cert-manager-install.yaml
│       └── prod/
│           ├── cluster-issuer.yaml
│           └── cert-manager-install.yaml
└── common/                  # 공통 리소스
    └── ingress/
        ├── local/
        │   └── ingress.yaml
        └── prod/
            └── ingress.yaml
```

## 🎯 장점

### 1️⃣ **명확한 환경 구분**
- 폴더만 보면 환경을 즉시 파악 가능
- 파일명에서 `-local`, `-prod` 접미사 제거

### 2️⃣ **배포 단순화**
```bash
# 로컬 환경 전체 배포
kubectl apply -f k8s/apps/*/local/
kubectl apply -f k8s/apps/*/common/

# 프로덕션 환경 전체 배포
kubectl apply -f k8s/apps/*/prod/
kubectl apply -f k8s/apps/*/common/
```

### 3️⃣ **공통 리소스 관리**
- `common/` 폴더에 환경 무관 리소스 집중
- 중복 제거 및 유지보수 용이

### 4️⃣ **향후 확장성**
- staging, dev 등 추가 환경 쉽게 추가 가능
- Kustomize로 전환 시에도 유리한 구조

## 🚀 배포 방법

### 로컬 환경
```bash
./scripts/deploy-local.sh
```

### 프로덕션 환경
```bash
./scripts/deploy-prod.sh [IMAGE_REGISTRY] [IMAGE_TAG]
```

## 📝 파일 명명 규칙

### local/ prod/ 폴더
- `deployment.yaml`: Deployment 리소스
- `service.yaml`: Service 리소스 (환경별 차이가 있는 경우만)
- `configmap.yaml`: ConfigMap 리소스
- `secret.yaml`: Secret 리소스
- `pvc.yaml`: PersistentVolumeClaim 리소스

### common/ 폴더
- 환경 무관 리소스 (주로 Service)
- 모든 환경에서 동일하게 사용하는 설정

## 🔍 환경별 차이점

### 로컬 환경 (local/)
- **PostgreSQL**: Self-hosted (K8s Pod)
- **Kafka**: 3노드 클러스터 (Ephemeral 스토리지)
- **Redis**: 단일 인스턴스
- **리소스**: 최소 요구사항 (개발 최적화)
- **TLS**: 자체 서명 인증서

### 프로덕션 환경 (prod/)
- **Oracle DB**: Autonomous Database (외부 관리)
- **Kafka**: 3노드 클러스터 (Persistent 스토리지)
- **Redis**: 고가용성 설정
- **리소스**: 프로덕션 워크로드 최적화
- **TLS**: Let's Encrypt 인증서

## 📚 관련 문서

- [배포 가이드](../docs/deployment-guide.md)
- [아키텍처](../docs/architecture.md)
- [로컬 개발 가이드](../docs/LOCAL_SETUP_GUIDE.md)
