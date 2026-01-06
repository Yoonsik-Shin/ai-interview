# 프로젝트 설정 가이드

이 문서는 AI 기반 HR/채용 솔루션 프로젝트를 설정하고 실행하는 방법을 설명합니다.

## 목차

- [프로젝트 개요](#프로젝트-개요)
- [사전 요구사항](#사전-요구사항)
- [환경 설정](#환경-설정)
- [서비스 실행](#서비스-실행)
- [서비스 확인](#서비스-확인)
- [트러블슈팅](#트러블슈팅)

## 프로젝트 개요

본 프로젝트는 실시간 화상 면접, 대용량 비정형 데이터(음성/영상) 분석, AI 역량 평가를 수행하는 지능형 채용 플랫폼입니다.

### 아키텍처

- **이벤트 기반 마이크로서비스 아키텍처 (EDMA)**
- **서비스 구성**:
  - API Gateway (Node.js/NestJS): Socket.io, gRPC, REST API
  - Core Service (Java/Spring Boot): 비즈니스 로직, 데이터 관리
  - Inference Service (Python/FastAPI): AI 추론 (OpenAI API)

### 기술 스택

- **Backend**: Node.js (NestJS), Java (Spring Boot), Python (FastAPI)
- **Database**: Oracle Autonomous Database (OCI)
- **Message Broker**: Apache Kafka
- **Cache**: Redis
- **Container**: Docker, Kubernetes

자세한 아키텍처 정보는 [architecture.md](./architecture.md)를 참조하세요.

## 사전 요구사항

다음 소프트웨어가 설치되어 있어야 합니다:

### 필수 소프트웨어

- **Docker Desktop**: 20.10 이상 (Kubernetes 활성화 필요)
- **kubectl**: 1.24 이상
- **Git**: 2.0 이상

### 선택적 소프트웨어 (로컬 개발용)

- **Node.js**: 18.x 이상 (API Gateway 로컬 실행용)
- **Java**: 21 이상 (Core Service 로컬 실행용)
- **Python**: 3.11 이상 (Inference Service 로컬 실행용)
- **Gradle**: 8.x 이상 (Core Service 빌드용)

### 외부 서비스

- **OpenAI API 키**: Inference Service에서 사용 (필수)
  - 발급: https://platform.openai.com/api-keys

## 환경 설정

### 1. 저장소 클론

```bash
git clone <repository-url>
cd ai-interview-project
```

### 2. 환경 변수 파일 생성

#### 루트 .env 파일

프로젝트 루트에 `.env` 파일을 생성하세요:

```bash
# .env 파일 생성
cat > .env << EOF
# Services
API_GATEWAY_PORT=3000
CORE_SERVICE_PORT=8081
INFERENCE_SERVICE_PORT=8000

# Kafka
KAFKA_BROKER_SERVICE=kafka:29092
SPRING_KAFKA_BOOTSTRAP_SERVERS=kafka:29092

# Redis
REDIS_HOST_SERVICE=redis

# Python Worker
PYTHON_WORKER_URL=http://worker-python:8000

# OpenAI (필수)
OPENAI_API_KEY=your-openai-api-key-here
EOF
```

> **참고**: 데이터베이스는 Oracle Autonomous Database를 사용합니다. 설정 방법은 [oracle-db-setup.md](./oracle-db-setup.md)를 참조하세요.

#### Inference Service .env 파일

```bash
# services/inference/.env 파일 생성
cat > services/inference/.env << EOF
OPENAI_API_KEY=your-openai-api-key-here
PORT=8000
EOF
```

> **중요**: `OPENAI_API_KEY`를 실제 API 키로 변경하세요.

자세한 환경 변수 설정은 [environment-setup.md](./environment-setup.md)를 참조하세요.

## 서비스 실행

### Kubernetes를 사용한 실행 (권장)

로컬 환경에서는 Docker Desktop의 Kubernetes를 사용하여 모든 서비스를 배포합니다.

#### 1. 이미지 빌드

먼저 모든 서비스 이미지를 빌드합니다:

```bash
# 로컬 테스트용 이미지 빌드 (AMD64)
./scripts/build-images.sh "" latest linux/amd64
```

#### 2. Kubernetes 배포

배포 스크립트를 실행하여 모든 서비스를 배포합니다:

```bash
# 모든 서비스 배포 (인프라 + 애플리케이션)
./scripts/deploy-local.sh
```

#### 3. 배포 상태 확인

```bash
# Pod 상태 확인
kubectl get pods

# 서비스 상태 확인
kubectl get services

# 특정 서비스 로그 확인
kubectl logs -l app=bff
kubectl logs -l app=core
kubectl logs -l app=inference
```

### 개별 서비스 실행 (로컬 개발용)

개발 중에는 특정 서비스만 로컬에서 실행할 수 있습니다:

#### 1. 인프라 서비스만 Kubernetes에 배포

```bash
# 인프라만 배포
kubectl apply -f k8s/infra/redis/redis-deployment-local.yaml
kubectl apply -f k8s/infra/redis/redis-service.yaml

kubectl apply -f k8s/infra/kafka/zookeeper-deployment-local.yaml
kubectl apply -f k8s/infra/kafka/zookeeper-service.yaml
kubectl apply -f k8s/infra/kafka/kafka-deployment-local.yaml
kubectl apply -f k8s/infra/kafka/kafka-service.yaml
```

> **참고**: 데이터베이스는 Oracle Autonomous Database를 사용합니다. 설정 방법은 [oracle-db-setup.md](./oracle-db-setup.md)를 참조하세요.

#### 2. BFF 서버 로컬 실행

```bash
cd services/api-gateway
npm install  # 또는 pnpm install
npm run start:dev
```

#### 3. Core Service 로컬 실행

```bash
cd services/core
./gradlew bootRun
```

#### 4. Inference Service 로컬 실행

```bash
cd services/inference
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 서비스 중지

```bash
# 모든 리소스 삭제
kubectl delete -f k8s/apps/
kubectl delete -f k8s/infra/
kubectl delete -f k8s/common/

# 또는 특정 리소스만 삭제
kubectl delete deployment bff
kubectl delete deployment core
kubectl delete deployment inference
```

## 서비스 확인

### 서비스 상태 확인

```bash
# 실행 중인 Pod 확인
kubectl get pods

# 서비스 확인
kubectl get services

# 서비스 헬스 체크
curl http://localhost:3000/health  # API Gateway
curl http://localhost:8081/actuator/health  # Core Service
curl http://localhost:8000/ping  # Inference Service
```

### 서비스 접속 정보

| 서비스            | URL                   | 포트 | 설명                |
| ----------------- | --------------------- | ---- | ------------------- |
| API Gateway       | http://localhost:3000 | 3000 | REST API, WebSocket |
| Core Service      | http://localhost:8081 | 8081 | gRPC, REST API      |
| Inference Service | http://localhost:8000 | 8000 | REST API            |
| Kafka UI          | http://localhost:8080 | 8080 | Kafka 관리 UI       |
| Redis             | localhost:6379        | 6379 | 캐시                |
| Kafka             | localhost:9092        | 9092 | 메시지 브로커       |

> **참고**: 데이터베이스는 Oracle Autonomous Database(OCI)를 사용합니다.

### Kafka UI 접속

1. 브라우저에서 http://localhost:8080 접속
2. 클러스터 정보 확인
3. 토픽 및 메시지 확인

## 트러블슈팅

### 일반적인 문제

#### 1. Pod가 시작되지 않음

**증상**: Pod가 `Pending` 또는 `CrashLoopBackOff` 상태

**해결 방법**:

```bash
# Pod 상태 상세 확인
kubectl describe pod <pod-name>

# Pod 로그 확인
kubectl logs <pod-name>

# 이벤트 확인
kubectl get events --sort-by='.lastTimestamp'
```

#### 2. Oracle DB 연결 실패

**증상**: `Connection refused` 또는 `authentication failed`

**해결 방법**:

1. Oracle DB 설정 확인: [oracle-db-setup.md](./oracle-db-setup.md) 참조
2. Secret 확인: `kubectl get secret oracle-db-credentials`
3. ConfigMap 확인: `kubectl get configmap core-config -o yaml`
4. Core Pod 로그 확인: `kubectl logs -l app=core`
5. 트러블슈팅 가이드: [oracle-troubleshooting.md](./oracle-troubleshooting.md) 참조

#### 3. Kafka 연결 실패

**증상**: `Connection refused` 또는 `Broker not available`

**해결 방법**:

1. Kafka와 Zookeeper Pod가 실행 중인지 확인: `kubectl get pods -l app=kafka`
2. Kafka 로그 확인: `kubectl logs -l app=kafka`
3. Kafka Service 확인: `kubectl get svc kafka`
4. 환경 변수 확인: `kubectl get deployment kafka -o yaml | grep KAFKA`

#### 4. OpenAI API 키 오류

**증상**: `Invalid API key` 또는 `401 Unauthorized`

**해결 방법**:

1. ConfigMap 확인: `kubectl get configmap inference-env -o yaml`
2. API 키가 유효한지 확인: https://platform.openai.com/api-keys
3. Inference Service 재시작: `kubectl rollout restart deployment inference`

#### 5. Spring Boot 프로파일 오류

**증상**: 설정이 적용되지 않음

**해결 방법**:

1. Deployment의 환경 변수 확인: `kubectl get deployment core -o yaml | grep SPRING`
2. `application-{profile}.properties` 파일 존재 확인
3. 애플리케이션 로그에서 활성화된 프로파일 확인: `kubectl logs -l app=core`

### 로그 확인

```bash
# 특정 Pod 로그 확인
kubectl logs <pod-name>

# Label로 로그 확인
kubectl logs -l app=bff

# 실시간 로그 확인
kubectl logs -f <pod-name>

# 최근 100줄 로그
kubectl logs --tail=100 <pod-name>

# 특정 시간 이후 로그
kubectl logs --since=10m <pod-name>
```

### Pod 재시작

```bash
# 특정 Deployment 재시작
kubectl rollout restart deployment bff

# 모든 Deployment 재시작
kubectl rollout restart deployment --all

# Pod 강제 삭제 (자동 재생성됨)
kubectl delete pod <pod-name>
```

### 데이터베이스 설정

데이터베이스는 Oracle Autonomous Database를 사용합니다. 설정 및 트러블슈팅은 다음 문서를 참조하세요:

- [Oracle DB 설정 가이드](./oracle-db-setup.md)
- [Oracle DB 트러블슈팅](./oracle-troubleshooting.md)

## 다음 단계

- [아키텍처 문서](./architecture.md) 읽기
- [환경 변수 설정 가이드](./environment-setup.md) 참조
- API 문서 확인 (서비스별 README 참조)

## 추가 리소스

- [Kubernetes 공식 문서](https://kubernetes.io/docs/)
- [배포 가이드](./deployment-guide.md) - 상세한 배포 방법
- [Spring Boot 공식 문서](https://spring.io/projects/spring-boot)
- [NestJS 공식 문서](https://docs.nestjs.com/)
- [FastAPI 공식 문서](https://fastapi.tiangolo.com/)
