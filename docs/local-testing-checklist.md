# 로컬 Kubernetes 테스트 체크리스트

Docker Desktop Kubernetes에서 로컬 테스트를 위한 체크리스트입니다.

## 사전 준비사항

### 1. Kubernetes 클러스터 확인
```bash
# kubectl context 확인
kubectl config current-context
# 출력: docker-desktop

# 클러스터 정보 확인
kubectl cluster-info
# 출력: Kubernetes control plane is running at https://127.0.0.1:6443

# 노드 확인
kubectl get nodes
```

### 2. 네임스페이스 확인
```bash
kubectl get namespaces
# unbrdn 네임스페이스가 있어야 합니다
```

## 필요한 Secret 및 ConfigMap

### 1. PostgreSQL Secret
```bash
kubectl get secret postgres-credentials -n unbrdn
```

없으면 생성:
```bash
kubectl apply -f k8s/infra/postgres/postgres-secret-local.yaml
```

### 2. PostgreSQL ConfigMap
```bash
kubectl get configmap postgres-config -n unbrdn
```

### 3. Inference Secret (OpenAI API Key)
```bash
kubectl get secret inference-secrets -n unbrdn
```

없으면 생성:
```bash
kubectl create secret generic inference-secrets \
  --from-literal=OPENAI_API_KEY='your-api-key-here' \
  --namespace=unbrdn \
  --dry-run=client -o yaml | kubectl apply -f -
```

## 이미지 빌드

### 로컬 이미지 빌드 (Docker Desktop용)
```bash
# 모든 서비스 이미지 빌드 (로컬용)
./scripts/build-images.sh "" latest linux/amd64
```

빌드되는 이미지:
- `bff:latest`
- `core:latest`
- `inference:latest`
- `socket:latest`

## 배포 순서

### 1. 인프라 서비스 배포
```bash
# Redis
kubectl apply -f k8s/infra/redis/redis-deployment-local.yaml
kubectl apply -f k8s/infra/redis/redis-service.yaml

# Zookeeper
kubectl apply -f k8s/infra/kafka/zookeeper-deployment-local.yaml
kubectl apply -f k8s/infra/kafka/zookeeper-service.yaml

# Kafka
kubectl apply -f k8s/infra/kafka/kafka-deployment-local.yaml
kubectl apply -f k8s/infra/kafka/kafka-service.yaml

# PostgreSQL
kubectl apply -f k8s/infra/postgres/postgres-configmap-local.yaml
kubectl apply -f k8s/infra/postgres/postgres-secret-local.yaml
kubectl apply -f k8s/infra/postgres/postgres-deployment-local.yaml
kubectl apply -f k8s/infra/postgres/postgres-service.yaml
```

### 2. 인프라 Pod 준비 대기
```bash
kubectl wait --for=condition=ready pod -l app=redis -n unbrdn --timeout=120s
kubectl wait --for=condition=ready pod -l app=zookeeper -n unbrdn --timeout=120s
kubectl wait --for=condition=ready pod -l app=kafka -n unbrdn --timeout=120s
kubectl wait --for=condition=ready pod -l app=postgres -n unbrdn --timeout=120s
```

### 3. 애플리케이션 서비스 배포
```bash
# Inference
kubectl apply -f k8s/apps/inference/env-configmap-local.yaml
kubectl apply -f k8s/apps/inference/deployment-local.yaml
kubectl apply -f k8s/apps/inference/service.yaml

# Core
kubectl apply -f k8s/apps/core/deployment-local.yaml
kubectl apply -f k8s/apps/core/service.yaml

# BFF
kubectl apply -f k8s/apps/bff/deployment-local.yaml
kubectl apply -f k8s/apps/bff/service.yaml

# Socket
kubectl apply -f k8s/apps/socket/configmap-local.yaml
kubectl apply -f k8s/apps/socket/deployment-local.yaml
kubectl apply -f k8s/apps/socket/service.yaml
```

### 4. 배포 스크립트 사용 (권장)
```bash
./scripts/deploy-local.sh
```

## 배포 상태 확인

### Pod 상태 확인
```bash
kubectl get pods -n unbrdn
```

모든 Pod가 `Running` 상태여야 합니다.

### 서비스 상태 확인
```bash
kubectl get services -n unbrdn
```

### 로그 확인
```bash
# BFF 로그
kubectl logs -l app=bff -n unbrdn --tail=50

# Core 로그
kubectl logs -l app=core -n unbrdn --tail=50

# Inference 로그
kubectl logs -l app=inference -n unbrdn --tail=50
```

## 환경변수 확인

### BFF Pod 환경변수
```bash
kubectl exec -n unbrdn deployment/bff -- env | grep -E "(REDIS|JWT|KAFKA|CORE)"
```

확인해야 할 환경변수:
- `REDIS_HOST=redis`
- `REDIS_PORT=6379`
- `JWT_SECRET=your-secret-key-change-in-production`
- `KAFKA_BROKER=kafka:29092`
- `CORE_GRPC_HOST=core`
- `CORE_GRPC_PORT=9090`

### Core Pod 환경변수
```bash
kubectl exec -n unbrdn deployment/core -- env | grep -E "(SPRING_|KAFKA)"
```

확인해야 할 환경변수:
- `SPRING_PROFILES_ACTIVE=local`
- `SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/interview_db`
- `SPRING_KAFKA_BOOTSTRAP_SERVERS=kafka:29092`

## 테스트

### 1. Health Check
```bash
# BFF
curl http://localhost:3000/ping

# Core (포트 포워딩 필요)
kubectl port-forward -n unbrdn svc/core 8081:8081
curl http://localhost:8081/actuator/health
```

### 2. Auth API 테스트
```bash
# 회원가입
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "nickname": "테스트유저"
  }'

# 로그인
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 3. gRPC 통신 확인
```bash
# Core Pod에서 gRPC 서비스 확인
kubectl exec -n unbrdn deployment/core -- netstat -tlnp | grep 9090
```

## 트러블슈팅

### Pod가 시작되지 않는 경우
```bash
# Pod 이벤트 확인
kubectl describe pod <pod-name> -n unbrdn

# 로그 확인
kubectl logs <pod-name> -n unbrdn
```

### 이미지 Pull 실패
로컬 이미지를 사용하므로 `imagePullPolicy: IfNotPresent`가 설정되어 있어야 합니다.

### 데이터베이스 연결 실패
```bash
# PostgreSQL Pod 확인
kubectl logs -l app=postgres -n unbrdn

# Secret 확인
kubectl get secret postgres-credentials -n unbrdn -o yaml
```

### Redis 연결 실패
```bash
# Redis Pod 확인
kubectl logs -l app=redis -n unbrdn

# Redis 테스트
kubectl exec -n unbrdn deployment/redis -- redis-cli ping
```

### Kafka 연결 실패
```bash
# Kafka Pod 확인
kubectl logs -l app=kafka -n unbrdn

# Kafka 토픽 확인 (Kafka UI 사용 또는 kubectl exec)
```

## 참고

- 모든 설정 파일은 `k8s/` 디렉토리에 있습니다
- 로컬 테스트는 `deployment-local.yaml` 파일을 사용합니다
- 프로덕션 배포는 `deployment-prod.yaml` 파일을 사용합니다







