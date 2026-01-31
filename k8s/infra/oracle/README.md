# Oracle Autonomous Database 로컬 환경 설정

## 개요

로컬 Kubernetes 환경에서도 프로덕션과 동일하게 Oracle Autonomous Database를 사용합니다.

## 설정 방법

### 1. Oracle Autonomous Database 생성

OCI 콘솔에서 Always Free Tier Autonomous Database를 생성합니다.
자세한 가이드는 `/docs/oracle-db-setup.md`를 참조하세요.

### 2. Connection String 확인

1. OCI 콘솔에서 Autonomous Database 선택
2. **Database Connection** 메뉴 클릭
3. **Connection Strings** 탭에서 **TLS** 연결 선택
4. **`_high`** 엔드포인트를 복사 (고가용성)

예시:

```
jdbc:oracle:thin:@adb.ap-chuncheon-1.oraclecloud.com:1522/abc123_interviewdb_high.adb.oraclecloud.com
```

### 3. Secret 생성

실제 Oracle DB 자격 증명으로 Secret을 생성합니다:

```bash
kubectl create secret generic oracle-db-credentials \
  --from-literal=username=ADMIN \
  --from-literal=password='YOUR_ACTUAL_PASSWORD' \
  -n unbrdn --dry-run=client -o yaml | kubectl apply -f -
```

또는 `oracle-secret-local.yaml` 파일을 직접 수정 후:

```bash
kubectl apply -f k8s/infra/oracle/oracle-secret-local.yaml
```

### 4. ConfigMap 업데이트

`oracle-configmap-local.yaml` 파일에서 실제 Connection String으로 업데이트:

```yaml
data:
  datasource-url: "jdbc:oracle:thin:@YOUR_ACTUAL_CONNECTION_STRING"
```

그 다음 적용:

```bash
kubectl apply -f k8s/infra/oracle/oracle-configmap-local.yaml
```

### 5. 배포 스크립트 실행

```bash
./scripts/deploy-local.sh
```

## 비용

- **Oracle Autonomous Database**: $0/월 (Always Free Tier)
- **Storage**: 1TB 무료
- **OCPU**: 2개 무료
- **데이터베이스**: 2개까지 무료

## 주의사항

### 보안

- Secret 파일을 Git에 커밋하지 마세요
- 실제 비밀번호는 환경변수나 별도 보안 저장소에서 관리하세요

### Always Free 제한

- 7일간 활동이 없으면 자동 정지 (데이터는 보존)
- 최대 30개 동시 세션 제한
- VCN 내부 배치 불가 (Public 액세스만 가능)

### 연결 유지

자동 정지를 방지하려면 주기적인 연결이 필요합니다:

- Kubernetes CronJob으로 주기적 Health Check
- 또는 애플리케이션에서 정기적인 쿼리 실행

## 트러블슈팅

자세한 트러블슈팅은 `/docs/oracle-troubleshooting.md`를 참조하세요.

### 연결 실패

```bash
# Core Pod 로그 확인
kubectl logs -l app=core -n unbrdn

# Secret 확인
kubectl get secret oracle-db-credentials -n unbrdn -o yaml

# ConfigMap 확인
kubectl get configmap oracle-config -n unbrdn -o yaml
```

### 데이터베이스 상태 확인

OCI 콘솔에서 Autonomous Database 상태가 **Available**인지 확인하세요.
