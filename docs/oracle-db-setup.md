# OCI Autonomous Database 설정 가이드

## 1. OCI Autonomous Database 생성

### 1.1 OCI 콘솔 접속

1. [OCI 콘솔](https://cloud.oracle.com/)에 로그인
2. 메뉴에서 **Oracle Database** → **Autonomous Database** 선택

### 1.2 서비스 선택 (중요!)

**중요**: 다음 3가지 옵션 중에서 선택해야 합니다:

- ✅ **자율운영 AI 데이터베이스** (Autonomous AI Database) ← **이것을 선택하세요!**
- ❌ 전용 인프라의 자율운영 AI 데이터베이스 (유료, Always Free 없음)
- ❌ Cloud@Customer의 Oracle Exadata Database Service (유료)

**"자율운영 AI 데이터베이스"**를 선택하면 Always Free Tier 옵션을 사용할 수 있습니다.

### 1.3 Autonomous Database 생성

1. **Create Autonomous Database** 클릭
2. 기본 정보 입력:

   - **Compartment**: 적절한 컴파트먼트 선택
   - **Display Name**: `interview-db` (또는 원하는 이름)
   - **Database Name**: `INTERVIEW_DB` (대문자, 최대 14자)

3. **Workload Type** 선택:

   - ✅ **트랜잭션 처리** (Transaction Processing) 선택 ← **이것을 선택하세요!**
   - ❌ 레이크하우스 (Lakehouse) - 분석/AI용, 우리 프로젝트에 부적합
   - ❌ JSON - JSON 중심 애플리케이션용
   - ❌ APEX - Oracle APEX 개발용

   **중요**: 현재 "레이크하우스"가 선택되어 있다면 "트랜잭션 처리"로 변경해야 합니다!

4. **Deployment Type**:

   - **Shared Infrastructure** 선택 (Always Free Tier)

5. **Always Free** 옵션:

   - ✅ **Always Free** 토글을 **ON**으로 설정 ← **반드시 켜야 합니다!**
   - 현재 화면에서 토글이 꺼져 있다면(off) → **켜야 합니다(on)**
   - 이 옵션을 켜면 비용이 $0입니다
   - Always Free를 켜지 않으면 유료 요금이 발생합니다!

6. **Database Configuration**:

   - **데이터베이스 버전**: **19c** 선택 (안정적이고 Always Free 지원)
     - 26ai는 최신 AI 기능이지만 Always Free에서는 19c 권장
   - **OCPU Count**: 2 (Always Free 최대값, Always Free를 켜면 자동 설정됨)
   - **Storage (TB)**: 1 (Always Free 최대값, Always Free를 켜면 자동 설정됨)

   **참고**: Always Free 토글을 켜면 OCPU와 Storage가 자동으로 설정됩니다.

7. **Create Administrator Credentials**:

   - **Username**: `ADMIN` (기본값 권장)
   - **Password**: 강력한 비밀번호 설정 (나중에 Secret에 저장)

8. **Network Access** (네트워크 액세스):

   - ✅ **모든 곳에서 보안 액세스** (Secure Access from Anywhere) 선택 ← **현재 선택된 상태가 맞습니다**
   - Always Free에서는 VCN 옵션을 사용할 수 없으므로 이 옵션이 유일한 선택입니다
   - **mTLS(상호 TLS) 인증**:
     - **현재 상태: OFF (기본값)** ← **이대로 두면 됩니다!**
     - mTLS는 무엇인가?
       - Mutual TLS: 클라이언트와 서버가 서로 인증서를 확인하는 이중 인증 방식
       - 더 강력한 보안이지만, 설정이 복잡하고 Always Free에서는 선택 사항
     - **권장**: OFF 상태 유지 (기본값으로 충분)
     - ON으로 설정하면 Wallet 파일이 필요하고 연결 설정이 복잡해짐

9. **Advanced Options** (고급 옵션):

   - **암호화 키** (Encryption Key):
     - ✅ **오라클 관리 키를 사용하여 암호화** (Encrypt using Oracle-managed keys) 선택 ← **기본값이 맞습니다**
     - Always Free에서는 Oracle 관리 키가 가장 간단하고 적합합니다

10. **License Type** (라이선스 유형):

- **자체 라이센스 적용**: **사용 안함** (Disabled) ← **이대로 두면 됩니다!**
- Always Free Tier에서는 라이선스가 자동으로 포함되어 있습니다
- "사용 안함" 상태가 정상이며, 별도 설정이 필요 없습니다
- **주의**: "사용"으로 변경하면 자체 라이선스가 필요하고 Always Free 혜택을 받을 수 없습니다

10. **Create Autonomous Database** 클릭

### 1.4 생성 전 체크리스트

생성 전 마지막 확인:

- [ ] Always Free 토글: **ON**
- [ ] 작업 로드: **트랜잭션 처리**
- [ ] 배포 유형: **Shared Infrastructure**
- [ ] 데이터베이스 버전: **19c**
- [ ] 관리자 비밀번호: **설정됨** (강력한 비밀번호)
- [ ] 네트워크 액세스: **모든 곳에서 보안 액세스**
- [ ] 라이선스: **License Included** (자동 포함)

모든 항목이 체크되면 **Create Autonomous Database** 버튼을 클릭하세요!

### 1.5 데이터베이스 생성 완료 대기

- 생성 시간: 약 5-10분 소요
- 상태가 **Available**이 되면 사용 가능

---

## 2. Connection Strings 확인

### 2.1 Connection Strings 가져오기

1. 생성된 Autonomous Database 클릭
2. **Database Connection** 메뉴 클릭
3. **Connection Strings** 탭 선택
4. **Connection Type**: **TLS** 선택 (또는 "상호 TLS" - mTLS)
5. **Wallet Type**: **Instance Wallet** 선택

### 2.1.1 TNS 이름 선택

TNS 이름 목록에서 다음 중 하나를 선택:

- ✅ **`<db_name>_high`** ← **프로덕션 환경에 권장!**

  - 고가용성 및 자동 페일오버 제공
  - 가장 안정적인 연결
  - 예: `unbrdn0krn0db_high`

- `_medium`: 중간 우선순위
- `_low`: 낮은 우선순위
- `_tp`: Transaction Processing용
- `_tpurgent`: 긴급 트랜잭션 처리용

**권장**: **`_high`** 선택 (고가용성)

### 2.2 JDBC URL 형식

```
jdbc:oracle:thin:@<host>:<port>/<service_name>
```

**예시:**

```
jdbc:oracle:thin:@adb.ap-chuncheon-1.oraclecloud.com:1522/abc123xyz_interview_db_high.adb.oraclecloud.com
```

**중요 정보:**

- **Host**: `adb.<region>.oraclecloud.com` 형식
- **Port**: `1522` (TLS)
- **Service Name**: `..._high.adb.oraclecloud.com` (고가용성 연결)

---

## 3. Kubernetes Secret 생성

### 3.1 Oracle DB Credentials Secret 생성

```bash
# Oracle DB 사용자 이름과 비밀번호를 Secret으로 생성
kubectl create secret generic oracle-db-credentials \
  --from-literal=username=ADMIN \
  --from-literal=password='<YOUR_PASSWORD>' \
  -n unbrdn
```

### 3.2 ConfigMap 업데이트

```bash
# ConfigMap에서 실제 Oracle DB URL로 업데이트
kubectl create configmap core-config \
  --from-literal=datasource-url='jdbc:oracle:thin:@<YOUR_HOST>:1522/<YOUR_SERVICE_NAME>' \
  --from-literal=kafka-bootstrap-servers='kafka-cluster-kafka-bootstrap.kafka:9092' \
  -n unbrdn \
  --dry-run=client -o yaml | kubectl apply -f -
```

**실제 값으로 교체:**

- `<YOUR_HOST>`: Connection Strings에서 확인한 Host
- `<YOUR_SERVICE_NAME>`: Connection Strings에서 확인한 Service Name

---

## 4. 애플리케이션 배포

### 4.1 이미지 재빌드

Oracle JDBC 드라이버가 포함된 새 이미지를 빌드합니다:

```bash
cd services/core
./gradlew build
cd ../..

# 이미지 빌드 및 푸시
./scripts/build-images.sh ap-chuncheon-1.ocir.io/axrywc89b6lf v1.1.0 linux/arm64
```

### 4.2 Core Deployment 업데이트

```bash
export IMAGE_REGISTRY="ap-chuncheon-1.ocir.io/axrywc89b6lf"
export IMAGE_TAG="v1.1.0"
envsubst < k8s/apps/core/deployment-prod.yaml | kubectl apply -f -
```

### 4.3 Deployment 환경 변수 확인

`deployment-prod.yaml`에서 다음 환경 변수가 올바르게 설정되었는지 확인:

```yaml
env:
  - name: SPRING_DATASOURCE_URL
    valueFrom:
      configMapKeyRef:
        name: core-config
        key: datasource-url
  - name: SPRING_DATASOURCE_USERNAME
    valueFrom:
      secretKeyRef:
        name: oracle-db-credentials
        key: username
  - name: SPRING_DATASOURCE_PASSWORD
    valueFrom:
      secretKeyRef:
        name: oracle-db-credentials
        key: password
```

---

## 5. Postgres Pod 제거

### 5.1 Postgres StatefulSet 삭제

```bash
kubectl delete statefulset postgres -n unbrdn
```

### 5.2 Postgres PVC 삭제 (선택사항)

```bash
# 데이터 백업이 필요하면 먼저 백업 수행
kubectl delete pvc postgres-data-postgres-0 -n unbrdn
```

### 5.3 Postgres Service 삭제 (선택사항)

```bash
kubectl delete service postgres -n unbrdn
```

### 5.4 Postgres ConfigMap 및 Secret 삭제 (선택사항)

```bash
kubectl delete configmap postgres-config -n unbrdn
kubectl delete secret postgres-credentials -n unbrdn
```

---

## 6. Core Pod 확장

### 6.1 Core Pod 2개로 확장

```bash
kubectl scale deployment core -n unbrdn --replicas=2
```

### 6.2 Pod 상태 확인

```bash
kubectl get pods -n unbrdn -l app=core
```

리소스가 확보되었으므로 Core Pod 2개가 정상 실행되어야 합니다.

---

## 7. PostgreSQL에서 마이그레이션 (필요시)

기존 PostgreSQL 데이터가 있다면 Oracle DB로 마이그레이션해야 합니다.

### 7.1 마이그레이션 준비

**코드 변경 완료 확인:**
- ✅ `build.gradle`: Oracle JDBC 드라이버 추가
- ✅ `application.properties`: PostgreSQL → Oracle 설정 변경
- ✅ `deployment-prod.yaml`: Secret 참조 변경 (oracle-db-credentials)
- ✅ `configmap-prod.yaml`: Oracle DB URL 형식

### 7.2 데이터 백업 (PostgreSQL)

```bash
# PostgreSQL에서 데이터 덤프
kubectl exec -it postgres-0 -n unbrdn -- pg_dump -U postgres interview_db > postgres_backup.sql
```

### 7.3 데이터 변환

PostgreSQL SQL을 Oracle SQL로 변환하는 작업이 필요합니다:

- 데이터 타입 변환
- 시퀀스 변환
- 함수/프로시저 변환

### 7.4 마이그레이션 실행

자동화 스크립트 사용:

```bash
# 마이그레이션 스크립트 실행
./scripts/migrate-to-oracle.sh unbrdn
```

또는 수동으로:

```bash
# Core Deployment 업데이트
export IMAGE_REGISTRY="ap-chuncheon-1.ocir.io/axrywc89b6lf"
export IMAGE_TAG="v1.1.0"
envsubst < k8s/apps/core/deployment-prod.yaml | kubectl apply -f -

# Postgres Pod 제거
kubectl delete statefulset postgres -n unbrdn

# Core Pod 확장 (이미 deployment-prod.yaml에 replicas: 2로 설정됨)
kubectl scale deployment core -n unbrdn --replicas=2
```

### 7.5 마이그레이션 결과

**리소스 확보:**
- **CPU**: 200m 확보 (Postgres Pod 제거)
- **메모리**: 256Mi 확보
- **Core Pod**: 2개 실행 가능 (고가용성)

**비용:**
- **Oracle DB**: $0/월 (Always Free Tier)
- **인프라**: $0/월 (OCI 프리티어)
- **총 비용**: $0/월 ✅

---

## 8. 연결 테스트

### 8.1 Core Pod 로그 확인

```bash
kubectl logs -l app=core -n unbrdn --tail=50
```

다음과 같은 메시지가 보이면 성공:

```
Started CoreJavaApplication in X.XXX seconds
```

### 8.2 데이터베이스 연결 확인

```bash
# Core Pod에서 직접 연결 테스트
kubectl exec -it <core-pod-name> -n unbrdn -- \
  java -cp /app/BOOT-INF/lib/* \
  -Dspring.datasource.url=$SPRING_DATASOURCE_URL \
  -Dspring.datasource.username=$SPRING_DATASOURCE_USERNAME \
  -Dspring.datasource.password=$SPRING_DATASOURCE_PASSWORD \
  org.springframework.boot.loader.JarLauncher
```

---

## 9. 트러블슈팅

자세한 트러블슈팅 가이드는 [oracle-troubleshooting.md](./oracle-troubleshooting.md)를 참조하세요.

### 9.1 연결 실패

- **원인**: 방화벽 규칙, 네트워크 설정
- **해결**: OCI 콘솔에서 Network Access 설정 확인

### 9.2 인증 실패

- **원인**: 잘못된 사용자 이름/비밀번호
- **해결**: Secret 값 확인 및 재생성

### 9.3 JDBC URL 오류

- **원인**: 잘못된 URL 형식
- **해결**: Connection Strings에서 정확한 URL 확인

---

## 10. 비용 확인

### Always Free Tier 제한사항

- **OCPU**: 2개
- **Storage**: 1TB
- **Database**: 2개까지
- **백업 보관**: 7일
- **비용**: $0/월

### 모니터링

OCI 콘솔에서 리소스 사용량을 모니터링하여 제한을 초과하지 않도록 주의하세요.

---

## 참고 자료

- [OCI Autonomous Database 문서](https://docs.oracle.com/en-us/iaas/Content/Database/Concepts/adboverview.htm)
- [Oracle JDBC 드라이버](https://www.oracle.com/database/technologies/appdev/jdbc.html)
- [Spring Boot Oracle Database 설정](https://spring.io/guides/gs/accessing-data-jpa/)
