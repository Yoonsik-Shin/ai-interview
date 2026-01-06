# 배포 가이드

이 문서는 AI 인터뷰 프로젝트를 로컬 환경(Docker Desktop)과 프로덕션 환경(Oracle Cloud OKE)에 배포하는 방법을 설명합니다.

## 목차

1. [개요](#개요)
2. [사전 요구사항](#사전-요구사항)
3. [로컬 환경 배포 (Docker Desktop)](#로컬-환경-배포-docker-desktop)
4. [프로덕션 환경 배포 (OCI OKE)](#프로덕션-환경-배포-oci-oke)
5. [이미지 빌드 및 푸시](#이미지-빌드-및-푸시)
6. [환경별 차이점](#환경별-차이점)
7. [트러블슈팅](#트러블슈팅)

## 개요

프로젝트는 두 가지 환경을 지원합니다:

- **로컬 환경 (Docker Desktop)**: 개발 및 테스트용

  - 인프라: Redis, Kafka (데이터베이스는 Oracle Autonomous Database 사용)
  - 로컬 이미지 사용
  - 최소 리소스 설정

- **프로덕션 환경 (OCI OKE)**: 실제 운영 환경
  - 데이터베이스: Oracle Autonomous Database (OCI)
  - Kafka: Strimzi Operator, 3개 Broker
  - 레지스트리 이미지 사용
  - ARM64 아키텍처 지원

## 사전 요구사항

### 로컬 환경

- Docker Desktop 설치 및 실행 중
- Kubernetes 활성화 (Docker Desktop 설정)
- kubectl 설치 및 클러스터 연결 확인

### 프로덕션 환경

- OCI OKE 클러스터 생성 완료
- kubectl이 OKE 클러스터에 연결됨
- OCIR (Oracle Container Image Registry) 접근 권한
- Oracle Autonomous Database 생성 완료 (설정 가이드: [oracle-db-setup.md](./oracle-db-setup.md))
- Strimzi Operator 설치 (프로덕션 Kafka 사용 시)

## 로컬 환경 배포 (Docker Desktop)

### 1. 환경 변수 설정

`.env` 파일을 생성하고 필요한 환경 변수를 설정합니다:

```bash
# Kafka
KAFKA_BROKER_ID=1
KAFKA_ZOOKEEPER_CONNECT=zookeeper:2181

# OpenAI (필수)
OPENAI_API_KEY=your-openai-api-key-here
```

> **참고**: 데이터베이스는 Oracle Autonomous Database를 사용합니다. 설정 방법은 [oracle-db-setup.md](./oracle-db-setup.md)를 참조하세요.

### 2. 이미지 빌드

로컬에서 이미지를 빌드합니다:

```bash
# 모든 서비스 이미지 빌드 (권장)
./scripts/build-images.sh "" latest linux/amd64

# 또는 개별 서비스 빌드
docker build -t bff:latest ./services/api-gateway
docker build -t core:latest ./services/core
docker build -t inference:latest ./services/inference
```

### 3. 배포 실행

배포 스크립트를 실행합니다:

```bash
./scripts/deploy-local.sh
```

### 4. 배포 확인

```bash
# Pod 상태 확인
kubectl get pods

# 서비스 확인
kubectl get services

# 로그 확인
kubectl logs -l app=bff
```

### 5. 접속 정보

- **API Gateway**: http://localhost:3000
- **Kafka UI**: http://localhost:8080/admin

## 프로덕션 환경 배포 (OCI OKE)

### 1. Strimzi Operator 설치

프로덕션 환경에서 Kafka를 사용하려면 Strimzi Operator가 필요합니다.

#### 기본 설치 방법

```bash
# Kafka 네임스페이스 생성
kubectl create namespace kafka

# Strimzi Operator 설치 (특정 네임스페이스 watch)
kubectl apply -f 'https://strimzi.io/install/latest?namespace=kafka' -n kafka

# 설치 확인
kubectl get deployment strimzi-cluster-operator -n kafka
```

이 방법은 Operator가 `kafka` 네임스페이스만 watch하도록 설정합니다.

#### 클러스터 전체 watch 설치 (권장)

Kafka 리소스를 `unbrdn` 네임스페이스에 배포하려면, Operator를 클러스터 전체 watch로 설치해야 합니다:

**방법 1: Helm 사용 (권장)**

```bash
# Helm repository 추가
helm repo add strimzi https://strimzi.io/charts/
helm repo update

# 클러스터 전체 watch로 설치
helm install strimzi-kafka-operator strimzi/strimzi-kafka-operator \
  --namespace kafka \
  --create-namespace \
  --set watchAnyNamespace=true
```

**방법 2: 매니페스트 수정 후 설치**

```bash
# 매니페스트 다운로드
curl -o strimzi-install.yaml 'https://strimzi.io/install/latest?namespace=kafka'

# STRIMZI_NAMESPACE 환경 변수 제거 또는 빈 값으로 설정
# (Deployment 부분 수정)

# 설치
kubectl apply -f strimzi-install.yaml -n kafka
```

**참고:** Kafka 네임스페이스 문제 해결에 대한 자세한 내용은 아래 "Kafka 네임스페이스 문제" 트러블슈팅 섹션을 참조하세요.

### 2. OCIR 인증 설정

OCI Container Registry (OCIR)에서 이미지를 Pull하기 위해서는 Kubernetes에 인증 정보를 등록해야 합니다.

#### OCIR 로그인 (Docker)

```bash
# OCIR 로그인
# 리전별 엔드포인트:
# - iad.ocir.io (US East - Ashburn)
# - phx.ocir.io (US West - Phoenix)
# - fra.ocir.io (Germany Central - Frankfurt)
# - lhr.ocir.io (UK South - London)
# - ap-seoul-1.ocir.io (South Korea Central - Seoul)
# - ap-chuncheon-1.ocir.io (South Korea - Chuncheon)

docker login <region>.ocir.io

# 사용자명 형식: <tenancy-namespace>/<username>
# 예시: axxxxxxxxxx/oracleidentitycloudservice/user@example.com
# 비밀번호: OCI Auth Token (OCI 콘솔에서 생성)
```

#### OCI Auth Token 생성

1. OCI 콘솔 로그인
2. 사용자 프로필 아이콘 클릭 → "Auth Tokens" 선택
3. "Generate Token" 클릭
4. 토큰 설명 입력 후 생성
5. 생성된 토큰을 복사 (한 번만 표시됨)

#### Kubernetes Secret 생성

OCIR 인증을 위한 Kubernetes Secret을 생성합니다:

```bash
kubectl create secret docker-registry ocir-secret \
  --docker-server=<region>.ocir.io \
  --docker-username='<tenancy-namespace>/<username>' \
  --docker-password='<auth-token>' \
  --docker-email='<email>' \
  -n unbrdn
```

**파라미터 설명:**

- `--docker-server`: OCIR 리전 엔드포인트 (예: `ap-chuncheon-1.ocir.io`)
- `--docker-username`: `<tenancy-namespace>/<username>` 형식
- `--docker-password`: OCI Auth Token
- `--docker-email`: 이메일 주소 (실제 사용되지 않지만 필수)

**Secret 확인:**

```bash
kubectl get secret ocir-secret -n unbrdn
kubectl describe secret ocir-secret -n unbrdn
```

**참고:** 모든 `deployment-prod.yaml` 파일에는 이미 `imagePullSecrets`가 설정되어 있으므로, Secret만 생성하면 자동으로 적용됩니다.

### 3. 이미지 빌드 및 푸시

ARM64 아키텍처를 지원하는 멀티 아키텍처 이미지를 빌드하고 OCIR에 푸시합니다:

```bash
# Buildx builder 생성 (최초 1회)
docker buildx create --name multiarch-builder --use
docker buildx inspect --bootstrap

# ARM64 이미지 빌드 및 푸시 (OCI Ampere A1용)
./scripts/build-images.sh <region>.ocir.io/<OCIR_NAMESPACE> v1.0.0 linux/arm64

# 예시: ap-chuncheon-1.ocir.io/axrywc89b6lf v1.0.0 linux/arm64

# 또는 멀티 아키텍처 이미지 (ARM64 + AMD64)
./scripts/build-images.sh <region>.ocir.io/<OCIR_NAMESPACE> v1.0.0 linux/amd64,linux/arm64
```

**레지스트리 URL 형식:**

- `<region>`: OCIR 리전 엔드포인트 (예: `ap-chuncheon-1`, `iad`, `ap-seoul-1`)
- `<OCIR_NAMESPACE>`: OCIR 네임스페이스 (예: `axrywc89b6lf`)
- **참고**: Compartment 경로(`/unbrdn` 등)는 포함하지 않습니다. Repository는 OCI 콘솔에서 해당 Compartment에 생성합니다.

**이미지 빌드 확인:**

```bash
# 빌드된 이미지 확인
docker images | grep <region>.ocir.io

# 또는 OCIR 콘솔에서 확인
# OCI 콘솔 → Developer Services → Container Registry
```

### 4. 배포 전 필수 확인 사항

배포 전 다음 사항을 확인하세요:

```bash
# 1. OKE 클러스터 연결 확인
kubectl cluster-info
kubectl get nodes

# 2. Strimzi Operator 설치 확인
kubectl get deployment strimzi-cluster-operator -n kafka

# 3. 네임스페이스 확인
kubectl get namespace unbrdn || kubectl create namespace unbrdn

# 4. 이미지 레지스트리 접근 확인
# (OCIR에 이미지가 푸시되었는지 확인)
```

**필수 Secret 및 ConfigMap 준비:**

1. **Oracle DB Secret 및 ConfigMap**: [oracle-db-setup.md](./oracle-db-setup.md) 참조
2. **Inference Secret**: `k8s/apps/inference/secret-prod.yaml` 수정 (OpenAI API 키)
3. **ConfigMap**: 대부분 기본값으로 설정되어 있으나 필요시 수정

### 5. Secret 및 ConfigMap 설정

프로덕션 환경의 민감한 정보를 Secret으로 설정합니다:

#### Oracle DB Secret 및 ConfigMap

Oracle DB 설정은 [oracle-db-setup.md](./oracle-db-setup.md)의 "3. Kubernetes Secret 생성" 섹션을 참조하세요.

```bash
# Oracle DB Secret 생성
kubectl create secret generic oracle-db-credentials \
  --from-literal=username=ADMIN \
  --from-literal=password='<YOUR_PASSWORD>' \
  -n unbrdn

# Oracle DB ConfigMap 생성
kubectl create configmap core-config \
  --from-literal=datasource-url='jdbc:oracle:thin:@<HOST>:1522/<SERVICE_NAME>' \
  --from-literal=kafka-bootstrap-servers='kafka-cluster-kafka-bootstrap.kafka:9092' \
  -n unbrdn \
  --dry-run=client -o yaml | kubectl apply -f -
```

### 6. 배포 실행

배포 스크립트를 실행합니다:

```bash
# 배포 실행
./scripts/deploy-prod.sh <region>.ocir.io/<OCIR_NAMESPACE> v1.0.0

# 예시:
# ./scripts/deploy-prod.sh ap-chuncheon-1.ocir.io/axrywc89b6lf v1.0.0
```

배포 스크립트는 다음 순서로 작업을 수행합니다:

1. 네임스페이스 생성
2. Strimzi Operator 설치 확인
3. 인프라 리소스 배포 (Redis, Kafka)
4. ConfigMap 및 Secret 배포
5. 애플리케이션 배포 (BFF, Core, Inference, Socket)
6. Kafka UI 배포
7. Ingress 배포

> **참고**: 데이터베이스는 Oracle Autonomous Database를 사용하므로 별도로 배포하지 않습니다. Oracle DB 설정은 배포 전에 완료해야 합니다. ([oracle-db-setup.md](./oracle-db-setup.md) 참조)

#### 변경사항 적용

**방법 1: 배포 스크립트 재실행 (권장)**

전체 배포 스크립트를 다시 실행하면 모든 변경사항이 자동으로 적용됩니다:

```bash
./scripts/deploy-prod.sh <region>.ocir.io/<OCIR_NAMESPACE> v1.0.0
```

**장점:**

- 모든 리소스가 일관되게 업데이트됨
- ConfigMap, Secret, Deployment 등 모두 업데이트

**방법 2: 개별 파일 적용**

특정 리소스만 선택적으로 업데이트:

```bash
# 환경 변수 설정
export IMAGE_REGISTRY=<region>.ocir.io/<OCIR_NAMESPACE>
export IMAGE_TAG=v1.0.0

# 인프라 리소스 업데이트
kubectl apply -f k8s/infra/redis/redis-deployment-prod.yaml
kubectl apply -f k8s/infra/kafka/strimzi-kafka-prod.yaml

# 애플리케이션 리소스 업데이트
envsubst < k8s/apps/bff/deployment-prod.yaml | kubectl apply -f -
envsubst < k8s/apps/core/deployment-prod.yaml | kubectl apply -f -
envsubst < k8s/apps/inference/deployment-prod.yaml | kubectl apply -f -
envsubst < k8s/apps/socket/deployment-prod.yaml | kubectl apply -f -
```

#### 롤백 방법

문제 발생 시 이전 버전으로 롤백:

```bash
# Deployment 롤백
kubectl rollout undo deployment/bff -n unbrdn
kubectl rollout undo deployment/core -n unbrdn
kubectl rollout undo deployment/inference -n unbrdn
kubectl rollout undo deployment/socket -n unbrdn

# 또는 특정 revision으로 롤백
kubectl rollout undo deployment/bff --to-revision=2 -n unbrdn
```

### 7. 배포 확인 및 검증

#### 7.1 Pod 상태 확인

```bash
# 모든 Pod 상태 확인
kubectl get pods -n unbrdn

# 특정 서비스 Pod 확인
kubectl get pods -n unbrdn -l app=bff
kubectl get pods -n unbrdn -l app=core
kubectl get pods -n unbrdn -l app=inference
kubectl get pods -n unbrdn -l app=socket

# Pod 상세 정보 확인 (문제 발생 시)
kubectl describe pod <pod-name> -n unbrdn
```

#### 7.2 서비스 확인

```bash
# 모든 서비스 확인
kubectl get svc -n unbrdn

# 특정 서비스 확인
kubectl get svc socket -n unbrdn
kubectl get svc bff -n unbrdn
```

#### 7.3 Kafka 클러스터 상태 확인

```bash
# Kafka 리소스 확인
kubectl get kafka kafka-cluster -n unbrdn

# Kafka Pod 확인
kubectl get pods -n unbrdn -l strimzi.io/cluster=kafka-cluster

# Kafka 로그 확인
kubectl logs -n unbrdn -l strimzi.io/cluster=kafka-cluster --tail=50
```

#### 7.4 Ingress 확인

```bash
# Ingress 상태 확인
kubectl get ingress main-ingress -n unbrdn

# Ingress 상세 정보 (Load Balancer IP 확인)
kubectl describe ingress main-ingress -n unbrdn
```

**Ingress Load Balancer IP 확인 후:**

- Load Balancer IP가 할당될 때까지 몇 분 소요될 수 있습니다
- 할당된 IP를 통해 서비스에 접근 가능합니다

#### 7.5 로그 확인

```bash
# BFF 서비스 로그
kubectl logs -n unbrdn -l app=bff --tail=100

# Socket 서비스 로그
kubectl logs -n unbrdn -l app=socket --tail=100

# Inference 서비스 로그
kubectl logs -n unbrdn -l app=inference --tail=100

# Core 서비스 로그
kubectl logs -n unbrdn -l app=core --tail=100

# 실시간 로그 확인
kubectl logs -n unbrdn -l app=socket -f
```

#### 7.6 서비스 연결 테스트

```bash
# Load Balancer IP 확인
INGRESS_IP=$(kubectl get ingress main-ingress -n unbrdn -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# API 엔드포인트 테스트
curl http://${INGRESS_IP}/

# Socket.io 연결 테스트 (WebSocket)
# 브라우저 개발자 도구에서 확인:
# ws://${INGRESS_IP}/socket.io/?EIO=4&transport=websocket
```

#### 7.7 배포 상태 요약

```bash
# 전체 배포 상태 확인
echo "=== Pods ==="
kubectl get pods -n unbrdn

echo -e "\n=== Services ==="
kubectl get svc -n unbrdn

echo -e "\n=== Ingress ==="
kubectl get ingress -n unbrdn

echo -e "\n=== Kafka Cluster ==="
kubectl get kafka -n unbrdn
```

## 이미지 빌드 및 푸시

### 멀티 아키텍처 이미지 빌드

Docker Buildx를 사용하여 ARM64와 AMD64를 모두 지원하는 이미지를 빌드합니다:

```bash
# Buildx builder 생성 (최초 1회)
docker buildx create --name multiarch-builder --use
docker buildx inspect --bootstrap

# 이미지 빌드 및 푸시
./scripts/build-images.sh iad.ocir.io/tenancy/namespace v1.0.0 linux/amd64,linux/arm64
```

### 로컬 이미지 빌드

로컬 테스트용 이미지를 빌드합니다:

```bash
# 로컬 빌드 (AMD64만)
./scripts/build-images.sh "" latest linux/amd64
```

## 환경별 차이점

| 항목               | 로컬 (Docker Desktop)      | 프로덕션 (OCI OKE)           |
| ------------------ | -------------------------- | ---------------------------- |
| **아키텍처**       | x86_64 (AMD64)             | ARM64 (Ampere A1)            |
| **Kafka**          | 단일 Broker                | Strimzi Operator, 3개 Broker |
| **Database**       | Oracle Autonomous DB (OCI) | Oracle Autonomous DB (OCI)   |
| **이미지**         | 로컬 빌드                  | OCIR에서 Pull                |
| **Ingress**        | NodePort/LoadBalancer      | OCI Load Balancer            |
| **리소스**         | 최소 설정                  | 아키텍처 요구사항 반영       |
| **Sticky Session** | 없음                       | Ingress에 설정됨             |
| **Socket 서비스**  | 1 Replica                  | 2 Replicas (고가용성)        |
| **BFF 서비스**     | 1 Replica                  | 3 Replicas (고가용성)        |
| **Core 서비스**    | 1 Replica                  | 2 Replicas (고가용성)        |

## 트러블슈팅

### Pod가 시작되지 않음

```bash
# Pod 상태 확인
kubectl describe pod <pod-name>

# 이벤트 확인
kubectl get events --sort-by='.lastTimestamp'
```

### 이미지 Pull 실패

```bash
# 이미지 Pull 정책 확인
kubectl get deployment <deployment-name> -o yaml | grep imagePullPolicy

# Secret 확인 (프로덕션)
kubectl get secret <registry-secret>
```

### Kafka 연결 실패

```bash
# Kafka Pod 상태 확인
kubectl get pods -l app=kafka

# Kafka 로그 확인
kubectl logs -l app=kafka

# Service 확인
kubectl get svc kafka
```

### Oracle DB 연결 실패

```bash
# Core Pod 상태 확인
kubectl get pods -n unbrdn -l app=core

# Core Pod 로그 확인
kubectl logs -n unbrdn -l app=core --tail=50

# Oracle DB Secret 확인
kubectl get secret oracle-db-credentials -n unbrdn

# ConfigMap 확인
kubectl get configmap core-config -n unbrdn -o yaml
```

자세한 트러블슈팅은 [oracle-troubleshooting.md](./oracle-troubleshooting.md)를 참조하세요.

### Strimzi Operator 문제

#### Operator 상태 확인

```bash
# Operator 상태 확인
kubectl get deployment strimzi-cluster-operator -n kafka

# Operator 로그 확인
kubectl logs -l name=strimzi-cluster-operator -n kafka

# Kafka 리소스 확인
kubectl get kafka -n unbrdn
```

#### Kafka 네임스페이스 문제

**문제 상황:**

- Strimzi Operator가 `kafka` 네임스페이스만 watch하고 있음
- Kafka 리소스가 `unbrdn` 네임스페이스에 있음
- 결과: Kafka Pod가 생성되지 않음

**해결 방법:**

**옵션 1: Kafka를 kafka 네임스페이스로 이동 (간단)**

장점: 확실하게 작동함, Operator 설정 변경 불필요
단점: 프로젝트 구조와 일치하지 않음

**옵션 2: Strimzi Operator를 클러스터 전체 watch로 재설치 (권장)**

장점: 프로젝트 구조 유지 (Kafka도 unbrdn)
단점: Operator 재설치 필요

위의 "Strimzi Operator 설치" 섹션에서 클러스터 전체 watch 설치 방법을 참조하세요.

### Socket 서비스 연결 실패

```bash
# Socket Pod 상태 확인
kubectl get pods -n unbrdn -l app=socket

# Socket 서비스 확인
kubectl get svc socket -n unbrdn

# Socket 로그 확인
kubectl logs -n unbrdn -l app=socket --tail=100

# Ingress에서 Socket.io 경로 확인
kubectl describe ingress main-ingress -n unbrdn | grep socket

# Redis 연결 확인 (Socket 서비스가 Redis를 사용)
kubectl get pods -n unbrdn -l app=redis
kubectl logs -n unbrdn -l app=socket | grep -i redis
```

### 이미지 Pull 실패 (OCIR)

```bash
# ImagePullSecret 확인
kubectl get secret -n unbrdn | grep ocir

# ImagePullSecret 생성 (필요한 경우)
kubectl create secret docker-registry ocir-secret \
  --docker-server=<region>.ocir.io \
  --docker-username='<tenancy-namespace>/<username>' \
  --docker-password='<auth-token>' \
  --docker-email='<email>' \
  -n unbrdn

# Deployment에 ImagePullSecret 추가
# deployment-prod.yaml의 spec.template.spec에 추가:
# imagePullSecrets:
#   - name: ocir-secret
```

### Ingress Load Balancer IP 미할당

```bash
# Ingress 이벤트 확인
kubectl describe ingress main-ingress -n unbrdn

# OCI 콘솔에서 Load Balancer 확인
# Networking → Load Balancers

# Ingress Controller 확인
kubectl get pods -n ingress-nginx
```

### NLB 보안 설정 문제

NLB IP로 접근 시 페이지가 계속 로딩만 되고 응답이 없는 경우, 보안 리스트(Security List) 설정 문제일 가능성이 높습니다.

#### 해결 방법

**1. NLB 서브넷의 보안 리스트 설정**

1. OCI 콘솔 → Networking → Virtual Cloud Networks → VCN 선택
2. Subnets → NLB가 생성된 서브넷 선택
3. Security Lists → 보안 리스트 선택 → Ingress Rules 확인

**필수 인바운드 규칙 추가:**

- Source: `0.0.0.0/0`, Protocol: TCP, Port: 80 (HTTP)
- Source: `0.0.0.0/0`, Protocol: TCP, Port: 443 (HTTPS)

**2. 백엔드 서버(노드) 서브넷의 보안 리스트 설정 (중요!)**

Kubernetes 노드가 있는 서브넷의 보안 리스트를 확인:

1. OCI 콘솔 → Networking → Virtual Cloud Networks → VCN 선택
2. Subnets → Kubernetes 노드가 있는 서브넷 선택
3. Security Lists → 보안 리스트 선택 → Ingress Rules 확인

**필수 인바운드 규칙 추가:**

- Source: `10.0.0.0/16` (VCN CIDR), Protocol: TCP, Port: All
- 또는 Source: `<NLB 서브넷 CIDR>`, Protocol: TCP, Port: All

**특히 필요한 포트:**

- 포트 80, 443: Ingress Controller
- 포트 3000-4000: 애플리케이션 서비스 (BFF, Socket 등)
- 포트 10250: Kubelet (Health Check용)

**3. NLB 백엔드 설정 확인**

1. OCI 콘솔 → Networking → Network Load Balancers → NLB 선택
2. Backend Sets 탭에서 백엔드 서버가 올바르게 등록되어 있는지 확인
3. Health Check 상태 확인 (실패하면 트래픽 전달 안 됨)

**참고:**

- NLB는 Layer 4 로드 밸런서이므로 패킷을 직접 전달합니다
- 보안 리스트 설정이 올바르지 않으면 연결이 타임아웃됩니다
- 설정 변경 후 즉시 적용되지만, 캐시로 인해 몇 분 걸릴 수 있습니다

## 리소스 모니터링

### 현재 상태 확인

```bash
# 노드 리소스 할당량 확인
kubectl describe nodes | grep -A 10 "Allocated resources:"

# Pod별 리소스 요청/제한 확인
kubectl get pods -n unbrdn -o custom-columns=NAME:.metadata.name,CPU-REQ:.spec.containers[0].resources.requests.cpu,CPU-LIM:.spec.containers[0].resources.limits.cpu,MEM-REQ:.spec.containers[0].resources.requests.memory,MEM-LIM:.spec.containers[0].resources.limits.memory
```

### Metrics-Server 설치 (실제 사용량 확인)

OCI OKE 클러스터에는 기본적으로 metrics-server가 포함되어 있을 수 있지만, 설치되지 않은 경우:

```bash
# OKE의 경우 OCI 콘솔에서 Metrics Server 플러그인 활성화
# OCI 콘솔 → Developer Services → Kubernetes (OKE) → 클러스터 선택 → Add-ons → Metrics Server 활성화

# 또는 직접 설치 (일반 Kubernetes)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

**Metrics-Server 설치 후 사용:**

```bash
# 노드별 실제 CPU/메모리 사용량
kubectl top nodes

# Pod별 실제 CPU/메모리 사용량
kubectl top pods -n unbrdn

# 실시간 모니터링
watch -n 2 kubectl top pods -n unbrdn
```

### 리소스 최적화

현재 리소스 요청량이 실제 사용량보다 훨씬 높은 경우가 많습니다. 리소스 최적화를 통해 동일 노드에서 더 많은 서비스를 실행할 수 있습니다.

**권장 사항:**

- 실제 사용량을 모니터링하여 요청량 조정
- Burst 트래픽을 고려하여 Limit은 여유있게 설정
- 점진적으로 조정하며 모니터링

자세한 분석 및 권장 리소스 할당량은 프로덕션 환경의 실제 사용량을 측정한 후 결정하세요.

## 추가 리소스

- [아키텍처 문서](./architecture.md)
- [환경 설정 가이드](./environment-setup.md)
- [설정 가이드](./setup-guide.md)
