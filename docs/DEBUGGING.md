# 디버깅 가이드

로컬 Kubernetes 환경에서 디버깅하는 방법을 설명합니다.

## 주요 문제 확인

로그를 확인한 결과:
- ✅ BFF 서비스: WebSocket 메시지 수신 정상
- ❌ Inference 서비스: OpenAI API 키 누락 (401 에러)
- ✅ Core 서비스: 정상 실행 중

## 1. 실시간 로그 모니터링

### 모든 서비스 로그 확인
```bash
# BFF (WebSocket 서버)
kubectl logs -f -n unbrdn -l app=bff

# Inference (AI 서비스)
kubectl logs -f -n unbrdn -l app=inference

# Core (Java 서비스)
kubectl logs -f -n unbrdn -l app=core

# Kafka
kubectl logs -f -n unbrdn -l app=kafka
```

### 특정 Pod의 로그 확인
```bash
# Pod 이름 확인
kubectl get pods -n unbrdn

# 특정 Pod 로그 확인
kubectl logs -f -n unbrdn <pod-name>
```

## 2. OpenAI API 키 설정

### 현재 설정 확인
```bash
kubectl get configmap inference-env -n unbrdn -o yaml
```

### API 키 설정 방법

#### 방법 1: ConfigMap 수정
```bash
kubectl edit configmap inference-env -n unbrdn
```

다음과 같이 수정:
```yaml
data:
  OPENAI_API_KEY: "your-actual-api-key-here"
  PORT: "8000"
```

그 다음 Inference Pod 재시작:
```bash
kubectl rollout restart deployment inference -n unbrdn
```

#### 방법 2: ConfigMap 파일 직접 수정
`k8s/apps/inference/env-configmap-local.yaml` 파일을 수정한 후:
```bash
kubectl apply -f k8s/apps/inference/env-configmap-local.yaml
kubectl rollout restart deployment inference -n unbrdn
```

## 3. Pod 환경 변수 확인

### Pod에 접속해서 환경 변수 확인
```bash
# Inference Pod 접속
kubectl exec -it -n unbrdn $(kubectl get pod -l app=inference -n unbrdn -o jsonpath='{.items[0].metadata.name}') -- sh

# 환경 변수 확인
env | grep OPENAI

# Python으로 API 키 테스트
python3 -c "import os; print('API Key:', os.getenv('OPENAI_API_KEY', 'NOT SET')[:10] + '...' if os.getenv('OPENAI_API_KEY') else 'NOT SET')"
```

## 4. 서비스 간 연결 테스트

### BFF -> Inference 연결 테스트
```bash
# Inference Pod에서 직접 테스트
kubectl exec -it -n unbrdn $(kubectl get pod -l app=inference -n unbrdn -o jsonpath='{.items[0].metadata.name}') -- sh
curl -X POST http://localhost:8000/interview -H "Content-Type: application/json" -d '{"user_answer": "테스트"}'
```

### BFF -> Kafka 연결 테스트
```bash
# BFF Pod에서 Kafka 연결 테스트
kubectl exec -it -n unbrdn $(kubectl get pod -l app=bff -n unbrdn -o jsonpath='{.items[0].metadata.name}') -- sh
nc -zv kafka 29092
```

## 5. 포트 포워딩으로 직접 접근

```bash
# BFF
kubectl port-forward -n unbrdn svc/bff 3000:3000

# Inference
kubectl port-forward -n unbrdn svc/inference 8000:8000

# Core
kubectl port-forward -n unbrdn svc/core 8081:8081

# Kafka UI
kubectl port-forward -n unbrdn svc/kafka-ui 8080:8080
```

포트 포워딩 후:
- http://localhost:3000/ping (BFF 테스트)
- http://localhost:8000/ping (Inference 테스트)
- http://localhost:8000/interview (POST 요청 테스트)

## 6. Pod 상태 상세 확인

```bash
# Pod 상세 정보
kubectl describe pod -n unbrdn <pod-name>

# Pod 이벤트 확인
kubectl get events -n unbrdn --sort-by='.lastTimestamp'

# 리소스 사용량 확인
kubectl top pods -n unbrdn
```

## 7. 서비스 재시작

```bash
# 특정 서비스 재시작
kubectl rollout restart deployment bff -n unbrdn
kubectl rollout restart deployment inference -n unbrdn
kubectl rollout restart deployment core -n unbrdn

# 재시작 상태 확인
kubectl rollout status deployment inference -n unbrdn
```

## 8. 데이터베이스 확인

```bash
# PostgreSQL 접속
kubectl exec -it -n unbrdn $(kubectl get pod -l app=postgres -n unbrdn -o jsonpath='{.items[0].metadata.name}') -- psql -U user -d interview_db

# 테이블 확인
\dt

# 데이터 확인
SELECT * FROM interview_history;
```

## 9. Kafka 메시지 확인

```bash
# Kafka UI 접속 (포트 포워딩 필요)
kubectl port-forward -n unbrdn svc/kafka-ui 8080:8080
# 브라우저에서 http://localhost:8080/admin 접속

# 또는 Kafka Pod에서 직접 확인
kubectl exec -it -n unbrdn $(kubectl get pod -l app=kafka -n unbrdn -o jsonpath='{.items[0].metadata.name}') -- sh
```

## 10. 일반적인 디버깅 플로우

1. **로그 확인**: 문제가 발생한 서비스의 로그를 먼저 확인
2. **환경 변수 확인**: ConfigMap/Secret이 올바르게 설정되었는지 확인
3. **서비스 연결 테스트**: 네트워크 연결이 정상인지 확인
4. **Pod 재시작**: 설정 변경 후에는 Pod를 재시작해야 함
5. **상태 확인**: `kubectl get pods`, `kubectl describe pod`로 상태 확인

