# 환경 변수 설정 가이드

이 문서는 프로젝트에서 사용하는 환경 변수 목록과 설정 방법을 설명합니다.

## 목차

- [개요](#개요)
- [환경 변수 파일 생성](#환경-변수-파일-생성)
- [Docker Compose 환경 변수](#docker-compose-환경-변수)
- [서비스별 환경 변수](#서비스별-환경-변수)
- [환경 변수 우선순위](#환경-변수-우선순위)

## 개요

프로젝트는 다음 환경 변수 파일을 사용합니다:

- Kubernetes ConfigMap/Secret: Kubernetes 배포용 환경 변수
- `services/inference/.env`: Python Inference 서비스 로컬 실행용 환경 변수
- `services/api-gateway/.env`: Node.js BFF 서비스 로컬 실행용 환경 변수 (선택적)

## 환경 변수 파일 생성

### 1. Kubernetes ConfigMap 및 Secret 설정

Kubernetes 배포에서는 ConfigMap과 Secret을 사용하여 환경 변수를 관리합니다.

#### Oracle DB Secret 및 ConfigMap

Oracle DB 설정은 [oracle-db-setup.md](./oracle-db-setup.md)를 참조하세요.

#### Inference Service ConfigMap

```bash
# ConfigMap 생성
kubectl apply -f k8s/apps/inference/env-configmap-local.yaml
```

또는 직접 생성:

```bash
kubectl create configmap inference-env \
  --from-literal=OPENAI_API_KEY=your-openai-api-key-here \
  --from-literal=PORT=8000
```

### 2. Inference Service .env 파일

`services/inference/.env` 파일을 생성하고 다음 내용을 추가하세요:

```bash
# ============================================
# Inference Service 환경 변수
# ============================================

# ============================================
# OpenAI API
# ============================================
# OpenAI API 키를 설정하세요
# https://platform.openai.com/api-keys 에서 발급받을 수 있습니다
OPENAI_API_KEY=your-openai-api-key-here

# ============================================
# Service Configuration
# ============================================
# 서비스 포트 (기본값: 8000)
PORT=8000
```

### 3. BFF .env 파일 (선택적)

`services/api-gateway/.env` 파일을 생성하고 다음 내용을 추가하세요:

```bash
# ============================================
# BFF (Backend for Frontend) 환경 변수
# ============================================

# ============================================
# Service Configuration
# ============================================
# 서비스 포트 (기본값: 3000)
PORT=3000

# ============================================
# Redis Configuration
# ============================================
# Redis 호스트 (Docker Compose 환경에서는 'redis')
REDIS_HOST=redis
REDIS_PORT=6379

# ============================================
# Kafka Configuration
# ============================================
# Kafka 브로커 주소 (Docker Compose 환경에서는 'kafka:29092')
KAFKA_BROKER=kafka:29092

# ============================================
# External Services
# ============================================
# Python Inference Worker URL
PYTHON_WORKER_URL=http://worker-python:8000
```

## Kubernetes 환경 변수

### 필수 환경 변수

| 변수명              | 설명            | 기본값 | 필수 여부 | 설정 위치           |
| ------------------- | --------------- | ------ | --------- | ------------------- |
| `OPENAI_API_KEY`    | OpenAI API 키   | -      | **필수**  | ConfigMap 또는 Secret |

### 선택적 환경 변수

| 변수명                           | 설명                       | 기본값                                         | 설정 위치 |
| -------------------------------- | -------------------------- | ---------------------------------------------- | --------- |
| `PORT`                           | API Gateway 포트           | `3000`                                         | Deployment |
| `REDIS_HOST`                     | Redis 호스트 (서비스 이름) | `redis`                                        | Deployment |
| `REDIS_PORT`                     | Redis 포트                 | `6379`                                         | Deployment |
| `KAFKA_BROKER`                   | Kafka 브로커 주소          | `kafka:29092`                                  | Deployment |
| `PYTHON_WORKER_URL`              | Python Worker URL          | `http://inference:8000`                        | Deployment |
| `SPRING_DATASOURCE_URL`          | Spring DataSource URL      | Oracle DB URL (ConfigMap에서 설정) | Deployment |
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | Kafka Bootstrap Servers    | `kafka:29092`                                  | Deployment |
| `SPRING_PROFILES_ACTIVE`         | Spring Boot 프로파일       | `local`                                        | Deployment |

## 서비스별 환경 변수

### Core Service (Java/Spring Boot)

Core Service는 Spring Boot 프로파일을 통해 환경별 설정을 관리합니다.

#### 프로파일

- `local`: 로컬 개발 환경 (기본값)
- `prod`: 프로덕션 환경

#### 환경 변수

| 변수명                           | 설명                         | 기본값                                          |
| -------------------------------- | ---------------------------- | ----------------------------------------------- |
| `SPRING_PROFILES_ACTIVE`         | 활성화할 프로파일            | `local`                                         |
| `SPRING_DATASOURCE_URL`          | 데이터베이스 연결 URL        | Oracle DB URL (ConfigMap/Secret에서 설정)      |
| `SPRING_DATASOURCE_USERNAME`     | 데이터베이스 사용자명        | Oracle DB 사용자명 (Secret에서 설정)           |
| `SPRING_DATASOURCE_PASSWORD`     | 데이터베이스 비밀번호        | Oracle DB 비밀번호 (Secret에서 설정)           |
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | Kafka 브로커 주소            | `localhost:9092`                                |
| `SPRING_KAFKA_CONSUMER_GROUP_ID` | Kafka Consumer Group ID      | `core-java-group`                               |
| `SPRING_JPA_HIBERNATE_DDL_AUTO`  | Hibernate DDL 자동 생성 모드 | `update`                                        |
| `SPRING_JPA_SHOW_SQL`            | SQL 로깅 활성화 여부         | `false`                                         |
| `LOG_LEVEL`                      | 로그 레벨                    | `INFO`                                          |
| `LOG_LEVEL_CORE`                 | Core 패키지 로그 레벨        | `DEBUG`                                         |

### API Gateway (Node.js/NestJS)

| 변수명              | 설명              | 기본값                      |
| ------------------- | ----------------- | --------------------------- |
| `PORT`              | 서비스 포트       | `3000`                      |
| `REDIS_HOST`        | Redis 호스트      | `redis`                     |
| `REDIS_PORT`        | Redis 포트        | `6379`                      |
| `KAFKA_BROKER`      | Kafka 브로커 주소 | `kafka:29092`               |
| `PYTHON_WORKER_URL` | Python Worker URL | `http://worker-python:8000` |

### Inference Service (Python/FastAPI)

| 변수명           | 설명          | 기본값 | 필수 여부 |
| ---------------- | ------------- | ------ | --------- |
| `OPENAI_API_KEY` | OpenAI API 키 | -      | **필수**  |
| `PORT`           | 서비스 포트   | `8000` | 선택      |

## 환경 변수 우선순위

환경 변수는 다음 순서로 적용됩니다 (높은 우선순위부터):

1. **시스템 환경 변수**: 운영 체제 레벨에서 설정된 환경 변수
2. **Deployment 환경 변수**: Kubernetes Deployment의 `env` 섹션
3. **ConfigMap/Secret**: Kubernetes ConfigMap 또는 Secret에서 참조
4. **.env 파일**: 서비스 디렉토리의 `.env` 파일 (로컬 실행 시에만 사용)

## 보안 주의사항

1. **민감한 정보 보호**: `.env` 파일은 절대 버전 관리에 포함하지 마세요. `.gitignore`에 이미 포함되어 있습니다.
2. **프로덕션 환경**: 프로덕션 환경에서는 반드시 환경 변수로 민감한 정보를 제공하세요.
3. **기본값 사용 금지**: 프로덕션 환경에서는 기본 비밀번호를 사용하지 마세요.

## 문제 해결

### 환경 변수가 적용되지 않는 경우

1. ConfigMap/Secret이 올바르게 생성되었는지 확인:
   ```bash
   kubectl get configmap
   kubectl get secret
   ```

2. Deployment의 환경 변수 참조 확인:
   ```bash
   kubectl get deployment <deployment-name> -o yaml | grep -A 10 env
   ```

3. Pod 재시작:
   ```bash
   kubectl rollout restart deployment <deployment-name>
   ```

4. 환경 변수 이름이 정확한지 확인하세요 (대소문자 구분).

### Spring Boot 프로파일이 적용되지 않는 경우

1. `SPRING_PROFILES_ACTIVE` 환경 변수가 설정되어 있는지 확인하세요.
2. `application-{profile}.properties` 파일이 존재하는지 확인하세요.
3. 애플리케이션 로그에서 활성화된 프로파일을 확인하세요.
