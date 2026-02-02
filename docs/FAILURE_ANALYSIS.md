# Pod 실패 원인 분석 보고서

생성일: 2026-01-07

## 📊 현재 상태 요약

터미널 출력 기준으로 다음 Pod들이 문제를 겪고 있습니다:

- `core-5749864dfb-hgkfx`: **CrashLoopBackOff** (7회 재시작)
- `core-5749864dfb-qsmpm`: **CrashLoopBackOff** (7회 재시작)
- `core-7d989d8d55-shfcg`: **Running** (2회 재시작됨)
- `inference-74bf7f8bb6-czksc`: **Running** (2회 재시작됨, Liveness probe 실패)
- `inference-5bd7599c9b-lpccb`: **Pending** (리소스 부족)
- `inference-74bf7f8bb6-tlwxh`: **Pending** (리소스 부족)

---

## 🔴 문제 1: Core 서비스 - Oracle DB 연결 실패

### 증상

```
ORA-17002: I/O error: Connection reset, connect lapse 1 ms., Authentication lapse 0 ms.
java.net.SocketException: Connection reset
```

### 원인 분석

1. **ConfigMap 설정 확인됨**

   - `core-config` ConfigMap의 `datasource-url`은 실제 값으로 설정되어 있음:
     ```
     jdbc:oracle:thin:@adb.ap-chuncheon-1.oraclecloud.com:1522/gf042308c5c1882_unbrdn0krn0db_high.adb.oraclecloud.com
     ```

2. **Secret 존재 확인됨**

   - `oracle-db-credentials` Secret이 존재함

3. **가능한 원인들:**
   - **네트워크 연결 문제**: Oracle Autonomous Database에 대한 네트워크 접근이 차단되었을 수 있음
   - **방화벽/보안 그룹 설정**: Kubernetes 클러스터에서 Oracle DB로의 아웃바운드 연결이 차단됨
   - **DB 접근 권한**: Oracle DB의 접근 제어 목록(ACL)에 Kubernetes 클러스터 IP가 포함되지 않음
   - **인증 정보 오류**: Secret의 username/password가 잘못되었을 수 있음
   - **DB 서비스 상태**: Oracle DB가 일시적으로 중단되었거나 접근 불가 상태

### 해결 방법

#### 1단계: Oracle DB 연결 테스트

```bash
# Secret 값 확인
kubectl get secret oracle-db-credentials -n unbrdn -o jsonpath='{.data.username}' | base64 -d && echo ""
kubectl get secret oracle-db-credentials -n unbrdn -o jsonpath='{.data.password}' | base64 -d && echo ""

# 임시 Pod에서 연결 테스트
kubectl run oracle-test --rm -it --image=oraclelinux:8 --restart=Never -n unbrdn -- \
  bash -c "yum install -y oracle-instantclient-basic && \
  sqlplus -S \$(echo $(kubectl get secret oracle-db-credentials -n unbrdn -o jsonpath='{.data.username}' | base64 -d))/\$(echo $(kubectl get secret oracle-db-credentials -n unbrdn -o jsonpath='{.data.password}' | base64 -d))@adb.ap-chuncheon-1.oraclecloud.com:1522/gf042308c5c1882_unbrdn0krn0db_high.adb.oraclecloud.com <<EOF
SELECT 1 FROM DUAL;
EXIT;
EOF"
```

#### 2단계: OCI 콘솔에서 네트워크 접근 확인

1. OCI 콘솔 → Oracle Database → Autonomous Database
2. 생성한 DB 선택 → **Network** 탭
3. **Access Control List** 확인:
   - Kubernetes 클러스터의 노드 IP들이 허용 목록에 있는지 확인
   - 또는 **"Allow secure access from anywhere"** 옵션이 활성화되어 있는지 확인

#### 3단계: Secret 재생성 (필요시)

```bash
kubectl create secret generic oracle-db-credentials \
  --from-literal=username='ADMIN' \
  --from-literal=password='실제_비밀번호' \
  --namespace=unbrdn \
  --dry-run=client -o yaml | kubectl apply -f -

# Pod 재시작
kubectl rollout restart deployment core -n unbrdn
```

#### 4단계: 임시 해결책 - 연결 재시도 설정

Core 서비스의 `application-prod.properties`에 다음 설정 추가:

```properties
# HikariCP 연결 재시도 설정
spring.datasource.hikari.connection-timeout=30000
spring.datasource.hikari.maximum-pool-size=5
spring.datasource.hikari.minimum-idle=1
spring.datasource.hikari.connection-test-query=SELECT 1 FROM DUAL
```

---

## 🔴 문제 2: Inference 서비스 - OPENAI_API_KEY 누락

### 증상

- Liveness probe 실패: `HTTP probe failed with statuscode: 404`
- Pod가 재시작됨 (2회)

### 원인 분석

1. **Secret 확인 결과**

   ```bash
   kubectl get secret llm-secrets -n unbrdn -o jsonpath='{.data.OPENAI_API_KEY}' | base64 -d | wc -c
   # 결과: 0 (비어있음)
   ```

2. **문제점**

- `llm-secrets` Secret의 `OPENAI_API_KEY`가 비어있음
- `main.py`에서 `os.getenv("OPENAI_API_KEY")`가 `None`을 반환
- OpenAI 클라이언트 초기화 시 API 키가 없어서 오류 발생 가능

3. **Liveness probe 404 오류**
   - `/health` 엔드포인트는 존재하지만, 애플리케이션이 제대로 시작되지 않아 404 반환
   - 또는 헬스체크 경로가 잘못 설정되었을 수 있음

### 해결 방법

#### 1단계: Secret 생성/업데이트

```bash
# 실제 OpenAI API 키로 Secret 생성
kubectl create secret generic llm-secrets \
  --from-literal=OPENAI_API_KEY='sk-your-actual-api-key-here' \
  --namespace=unbrdn \
  --dry-run=client -o yaml | kubectl apply -f -

# Pod 재시작
kubectl rollout restart deployment llm -n unbrdn
```

#### 2단계: Secret 확인

```bash
# Secret이 제대로 생성되었는지 확인
# Secret 존재 여부 (길이 확인)
kubectl get secret llm-secrets -n unbrdn -o jsonpath='{.data.OPENAI_API_KEY}' | base64 -d | wc -c
# 결과가 0보다 커야 함 (API 키 길이)

# 실제 값 확인 (주의: 로그에 노출되지 않도록)
kubectl get secret llm-secrets -n unbrdn -o jsonpath='{.data.OPENAI_API_KEY}' | base64 -d | head -c 10 && echo "..."
```

#### 3단계: Pod 로그 확인

```bash
# LLM Pod 로그 확인
kubectl logs -n unbrdn -l app=llm --tail=100

# OpenAI API 키 관련 오류 메시지 확인
kubectl logs -n unbrdn -l app=llm | grep -i "api.*key\|openai\|error"
```

#### 4단계: 헬스체크 엔드포인트 확인

```bash
# 실행 중인 Pod에서 직접 테스트
kubectl exec -n unbrdn $(kubectl get pod -n unbrdn -l app=llm -o jsonpath='{.items[0].metadata.name}') -- \
  curl -s http://localhost:8000/health

# 예상 결과: {"status":"ok"}
```

---

## 🔴 문제 3: 리소스 부족으로 인한 Pending Pod

### 증상

- `inference-5bd7599c9b-lpccb`: **Pending** 상태
- `inference-74bf7f8bb6-tlwxh`: **Pending** 상태

### 원인 분석

1. **노드 리소스 현황**

   - 사용 가능한 CPU: 1830m (각 노드당)
   - Core Pod 요청: 3개 × 200m = 600m
   - Inference Pod 요청: 3개 × 200m = 600m
   - 총 요청: 1200m (다른 Pod들 제외)

2. **문제점**
   - Deployment에서 `replicas: 2`로 설정되어 있지만, 실제로는 3개의 Pod가 생성 시도됨
   - 이전 Deployment의 Pod들이 완전히 종료되지 않아 리소스가 부족함
   - 또는 다른 서비스들이 리소스를 많이 사용 중

### 해결 방법

#### 1단계: 불필요한 Pod 정리

```bash
# 이전 Deployment의 Pod 확인
kubectl get pods -n unbrdn | grep -E "(core|llm)"

# 이전 ReplicaSet의 Pod 삭제
kubectl delete pod -n unbrdn core-5749864dfb-hgkfx core-5749864dfb-qsmpm

# 또는 이전 ReplicaSet 전체 삭제
kubectl get rs -n unbrdn | grep -E "(core|llm)"
kubectl delete rs -n unbrdn <old-replicaset-name>
```

#### 2단계: Deployment 스케일 조정

```bash
# 임시로 replicas를 1로 줄여서 테스트
kubectl scale deployment llm -n unbrdn --replicas=1
kubectl scale deployment core -n unbrdn --replicas=1

# 문제 해결 후 원래대로 복구
kubectl scale deployment llm -n unbrdn --replicas=2
kubectl scale deployment core -n unbrdn --replicas=2
```

#### 3단계: 리소스 요청량 조정

`deployment-prod.yaml`에서 리소스 요청량을 줄일 수 있음:

```yaml
resources:
  requests:
    memory: "512Mi" # 1Gi → 512Mi
    cpu: "100m" # 200m → 100m
  limits:
    memory: "1Gi" # 2Gi → 1Gi
    cpu: "500m" # 1000m → 500m
```

#### 4단계: 노드 리소스 확인

```bash
# 노드별 리소스 사용량 확인
kubectl top nodes

# Pod별 리소스 사용량 확인
kubectl top pods -n unbrdn

# 리소스가 부족한 경우 노드 추가 고려
```

---

## 🔴 문제 4: Inference 서비스 Liveness Probe 404 오류

### 증상

```
Warning  Unhealthy  85s (x8 over 4m25s)   kubelet
spec.containers{inference}: Liveness probe failed: HTTP probe failed with statuscode: 404
```

### 원인 분석

1. **코드 확인**

   - `main.py`에 `/health` 엔드포인트가 존재함:
     ```python
     @app.get("/health")
     async def get_health():
         return {"status": "ok"}
     ```

2. **가능한 원인들:**
   - 애플리케이션이 완전히 시작되기 전에 헬스체크가 실행됨
   - FastAPI 애플리케이션이 제대로 마운트되지 않음
   - 포트 설정 문제 (8000번 포트가 아닌 다른 포트로 실행 중)
   - 경로 문제 (루트 경로가 아닌 다른 경로로 마운트됨)

### 해결 방법

#### 1단계: 헬스체크 지연 시간 증가

`deployment-prod.yaml` 수정:

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 60 # 30 → 60으로 증가
  periodSeconds: 20
  timeoutSeconds: 5 # 3 → 5로 증가
  failureThreshold: 5 # 3 → 5로 증가
```

#### 2단계: Readiness Probe 추가/수정

```yaml
readinessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

#### 3단계: Pod 로그에서 실제 포트 확인

```bash
kubectl logs -n unbrdn -l app=llm | grep -i "running\|port\|uvicorn"
# 예상 출력: "Uvicorn running on http://0.0.0.0:8000"
```

#### 4단계: 직접 헬스체크 테스트

```bash
# 실행 중인 Pod에서 직접 테스트
POD_NAME=$(kubectl get pod -n unbrdn -l app=llm -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n unbrdn $POD_NAME -- curl -v http://localhost:8000/health
```

---

## ✅ 종합 해결 순서

### 우선순위 1: Inference Secret 설정 (즉시 해결 가능)

```bash
# 1. OpenAI API 키로 Secret 생성
kubectl create secret generic llm-secrets \
  --from-literal=OPENAI_API_KEY='실제_API_키' \
  --namespace=unbrdn \
  --dry-run=client -o yaml | kubectl apply -f -

# 2. LLM Pod 재시작
kubectl rollout restart deployment llm -n unbrdn

# 3. 상태 확인
kubectl get pods -n unbrdn -l app=llm
kubectl logs -n unbrdn -l app=llm --tail=50
```

### 우선순위 2: Oracle DB 연결 문제 해결

```bash
# 1. Secret 값 확인
kubectl get secret oracle-db-credentials -n unbrdn -o yaml

# 2. OCI 콘솔에서 네트워크 접근 설정 확인
# - Autonomous Database → Network → Access Control List

# 3. 연결 테스트 (위의 "해결 방법" 참조)

# 4. Core Pod 재시작
kubectl rollout restart deployment core -n unbrdn
```

### 우선순위 3: 리소스 정리

```bash
# 1. 이전 Pod 정리
kubectl get pods -n unbrdn | grep -E "(core|inference)"
kubectl delete pod -n unbrdn <old-pod-name>

# 2. Deployment 스케일 조정 (필요시)
kubectl scale deployment inference -n unbrdn --replicas=1
kubectl scale deployment core -n unbrdn --replicas=1
```

### 우선순위 4: 헬스체크 설정 개선

- `deployment-prod.yaml`에서 liveness/readiness probe 설정 조정 (위의 "해결 방법" 참조)

---

## 📝 체크리스트

문제 해결 후 다음을 확인하세요:

- [ ] Core Pod가 정상적으로 Running 상태
- [ ] Inference Pod가 정상적으로 Running 상태
- [ ] 모든 Pod의 READY 상태가 1/1
- [ ] Core 서비스가 Oracle DB에 연결됨 (로그 확인)
- [ ] Inference 서비스가 OpenAI API를 호출할 수 있음 (Secret 확인)
- [ ] 헬스체크가 정상적으로 통과함
- [ ] Pending 상태인 Pod가 없음

---

## 🔍 추가 디버깅 명령어

```bash
# 전체 Pod 상태 확인
kubectl get pods -n unbrdn -o wide

# 특정 Pod 상세 정보
kubectl describe pod <pod-name> -n unbrdn

# Pod 로그 확인
kubectl logs <pod-name> -n unbrdn --tail=100

# 이전 컨테이너 로그 확인 (재시작된 경우)
kubectl logs <pod-name> -n unbrdn --previous

# 환경 변수 확인
kubectl exec <pod-name> -n unbrdn -- env | grep -E "(OPENAI|ORACLE|DATASOURCE)"

# ConfigMap/Secret 확인
kubectl get configmap -n unbrdn
kubectl get secret -n unbrdn

# Deployment 이벤트 확인
kubectl describe deployment core -n unbrdn
kubectl describe deployment inference -n unbrdn
```

---

## 📚 참고 문서

- [Oracle DB 설정 가이드](./oracle-db-setup.md)
- [LLM Secret 설정 가이드](../k8s/apps/llm/README-secret.md)
- [디버깅 가이드](./DEBUGGING.md)
- [배포 가이드](./deployment-guide.md)
