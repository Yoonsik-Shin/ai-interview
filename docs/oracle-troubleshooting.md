# Oracle DB 트러블슈팅 가이드

이 문서는 Oracle Autonomous Database 연결 및 설정 관련 문제를 해결하는 방법을 설명합니다.

## 목차

- [ACL 규칙 저장 문제](#acl-규칙-저장-문제)
- [ACL 연결 문제](#acl-연결-문제)
- [네트워크 접근 문제](#네트워크-접근-문제)
- [포트 비교](#포트-비교)
- [디버깅 명령어](#디버깅-명령어)
- [예상 원인 및 해결](#예상-원인-및-해결)

---

## ACL 규칙 저장 문제

### 문제 증상

에러 메시지:
> "No arguments or arguments same as current configuration were specified in the update request"

이 에러는 **규칙이 목록에 추가되지 않았을 때** 발생합니다.

### 올바른 저장 방법

#### 단계별 절차

1. **IP 표기법 유형 선택**
   - "CIDR 블록" 선택

2. **값 입력**
   - `0.0.0.0/0` 입력 (모든 IP 허용, 개발/테스트용)
   - 또는 특정 IP 주소 입력 (예: `61.73.103.65/32`)

3. **중요: "액세스 제어 규칙 추가" 버튼 클릭**
   - 이 버튼을 클릭해야 규칙이 **목록에 추가**됩니다
   - 입력 필드에만 있어서는 안 됩니다

4. **목록 확인**
   - 규칙이 목록에 표시되는지 확인
   - 목록에 `0.0.0.0/0` (또는 입력한 IP)이 보여야 합니다

5. **"저장" 버튼 클릭**
   - 목록에 규칙이 추가된 후에만 저장이 성공합니다

### 확인 방법

1. OCI 콘솔 → Oracle Database → Autonomous Database → Network → Access Control List → Edit
2. **목록에 규칙이 표시되어야 합니다**
3. 입력 필드가 비어있고, 목록에만 규칙이 있어야 합니다

### 규칙이 저장되지 않은 경우

- 입력 필드에만 규칙이 있고 목록이 비어있음
- "액세스 제어 규칙 추가" 버튼을 클릭하지 않음
- 이 경우 "저장"을 클릭해도 에러가 발생합니다

---

## ACL 연결 문제

### 현재 상태

- ✅ JDBC URL: 올바르게 설정됨
- ✅ Username/Password: 올바르게 설정됨
- ⚠️ ACL 설정: 완료했지만 연결 실패

### 확인 사항

#### 1. OCI 콘솔에서 ACL 규칙 확인

1. OCI 콘솔 → **Oracle Database** → **Autonomous Database**
2. 데이터베이스 클릭
3. **Network** → **Access Control List** → **Edit** 클릭
4. **규칙 목록 확인**:
   - 규칙이 **목록에 표시**되어야 합니다
   - 입력 필드에만 있고 목록에 없다면 **"액세스 제어 규칙 추가"** 버튼을 클릭하지 않은 것입니다

#### 2. ACL 규칙이 목록에 없는 경우

1. **"액세스 제어 규칙 추가"** 버튼 클릭
2. 규칙이 목록에 추가되는지 확인
3. **"저장"** 버튼 클릭
4. 저장 완료 메시지 확인

#### 3. ACL 규칙이 목록에 있는 경우

1. 규칙이 올바른지 확인 (`0.0.0.0/0` 또는 특정 IP)
2. **"저장"** 버튼이 활성화되어 있다면 클릭 (변경사항이 있을 수 있음)
3. **5-10분 대기** (ACL 변경사항 적용 시간)

#### 4. 여전히 연결이 안 되는 경우

**옵션 1: 특정 IP 주소 추가 (테스트용)**

1. 현재 컴퓨터의 공인 IP 확인:
   ```bash
   curl ifconfig.me
   ```

2. OCI 콘솔에서 해당 IP를 ACL에 추가:
   - IP 표기법 유형: **IP 주소**
   - 값: `<YOUR_PUBLIC_IP>/32`
   - 예: `61.73.103.65/32`

**옵션 2: Kubernetes 클러스터 외부 IP 확인**

```bash
# Kubernetes 노드의 외부 IP 확인
kubectl get nodes -o wide

# 또는 Core Pod가 실행 중인 노드의 IP 확인
kubectl get pods -n unbrdn -l app=core -o wide
```

해당 IP를 ACL에 추가

---

## 네트워크 접근 문제

### 문제 증상

Core Pod에서 Oracle DB 연결 시 다음 오류 발생:

```
ORA-17002: I/O error: Connection reset
java.net.SocketException: Connection reset
```

### 원인

Oracle Autonomous Database의 **네트워크 접근 제어 목록(ACL)**에 Kubernetes 클러스터의 IP 주소가 허용되지 않았을 가능성이 높습니다.

### 해결 방법

#### 1. OCI 콘솔에서 접근 제어 목록 확인

1. OCI 콘솔 → **Oracle Database** → **Autonomous Database**
2. 생성한 데이터베이스 클릭
3. **Network** 메뉴 클릭
4. **Access Control List** 섹션 확인

#### 2. 접근 제어 목록 설정

**옵션 1: 모든 IP 허용 (개발/테스트용)**

1. **Access Control List** 섹션에서 **Edit** 클릭
2. **Add Address** 클릭 (또는 "액세스 제어 규칙 추가" 버튼)
3. **Address Type**: **CIDR 블록** 선택
4. **Address**: `0.0.0.0/0` 입력 (모든 IP 허용)
5. **Description**: "Allow all IPs for development" (선택사항)
6. **"액세스 제어 규칙 추가"** 버튼 클릭 (규칙이 목록에 추가되는지 확인)
7. **Save** 클릭

**옵션 2: 특정 IP만 허용 (프로덕션 권장)**

1. Kubernetes 클러스터의 외부 IP 확인:
   ```bash
   kubectl get nodes -o wide
   ```

2. OCI 콘솔에서 해당 IP를 ACL에 추가:
   - Address Type: **IP 주소** 또는 **CIDR 블록**
   - 값: `<YOUR_IP>/32` (단일 IP) 또는 `<YOUR_IP_RANGE>/24` (IP 범위)

#### 3. 접근 제어 목록이 비어있는 경우

- **Access Control List**가 비어있거나 설정되지 않은 경우, 기본적으로 모든 접근이 차단됩니다.
- 반드시 **최소 1개 이상의 IP 주소 또는 CIDR 블록**을 추가해야 합니다.

#### 4. 설정 확인

설정 후 몇 분 기다린 다음 Core Pod를 재시작:

```bash
kubectl rollout restart deployment core -n unbrdn
```

### 추가 확인 사항

#### Database Connection 설정 확인

1. OCI 콘솔 → Autonomous Database → **Database Connection**
2. **Connection Strings** 탭 확인
3. **Connection Type**: **TLS** 선택 (mTLS 아님)
4. **Wallet Type**: **Instance Wallet** 선택
5. JDBC URL 형식 확인:
   ```
   jdbc:oracle:thin:@adb.ap-chuncheon-1.oraclecloud.com:1522/<service_name>
   ```

#### 네트워크 설정 확인

1. OCI 콘솔 → Autonomous Database → **Network**
2. **Access Type**: "모든 곳에서 보안 액세스" 또는 "지정된 IP 및 VCN에서 보안 액세스 허용" 확인
3. **Access Control List**: "사용" 확인

---

## 포트 비교

### TNS 연결 문자열 vs JDBC URL

**TNS 연결 문자열:**
```
unbrdn0krn0db_high
(description= (retry_count=20)(retry_delay=3)
  (address=(protocol=tcps)(port=1521)(host=adb.ap-chuncheon-1.oraclecloud.com))
  (connect_data=(service_name=gf042308c5c1882_unbrdn0krn0db_high.adb.oraclecloud.com))
  (security=(ssl_server_dn_match=yes)))
```

**요약:**
- Protocol: `tcps` (TLS)
- Port: `1521`
- Host: `adb.ap-chuncheon-1.oraclecloud.com`
- Service Name: `gf042308c5c1882_unbrdn0krn0db_high.adb.oraclecloud.com`

**JDBC URL (현재 ConfigMap 설정):**
```
jdbc:oracle:thin:@adb.ap-chuncheon-1.oraclecloud.com:1522/gf042308c5c1882_unbrdn0krn0db_high.adb.oraclecloud.com
```

**요약:**
- Protocol: `thin` (JDBC thin driver, TLS 자동 사용)
- Port: `1522`
- Host: `adb.ap-chuncheon-1.oraclecloud.com`
- Service Name: `gf042308c5c1882_unbrdn0krn0db_high.adb.oraclecloud.com`

### 포트 차이점

#### 포트 1521
- TNS 연결에서 사용
- TLS 지원 (`tcps`)
- Oracle Autonomous Database에서 지원

#### 포트 1522
- JDBC 연결에서 일반적으로 사용
- TLS 지원
- Oracle Autonomous Database에서 **권장되는 JDBC 포트**

### 권장 사항

**현재 설정(포트 1522)이 올바릅니다.**

이유:
1. Oracle Autonomous Database 문서에서 JDBC 연결 시 포트 1522 사용 권장
2. TNS와 JDBC는 다른 프로토콜이므로 포트가 다를 수 있음
3. 두 포트 모두 TLS를 지원하지만, JDBC에서는 1522가 표준

### 확인 사항

현재 설정이 올바른지 확인:
- ✅ Host: 일치
- ✅ Service Name: 일치
- ✅ Protocol: TLS (둘 다)
- ⚠️ Port: 1521 (TNS) vs 1522 (JDBC) - **이것은 정상입니다**

### 문제가 지속되는 경우

포트 1521로 변경해볼 수 있습니다:

```bash
kubectl create configmap core-config \
  --from-literal=datasource-url="jdbc:oracle:thin:@adb.ap-chuncheon-1.oraclecloud.com:1521/<service_name>" \
  --from-literal=kafka-bootstrap-servers="kafka-cluster-kafka-bootstrap.kafka:9092" \
  -n unbrdn --dry-run=client -o yaml | kubectl apply -f -
```

하지만 **포트 1522가 표준**이므로, 연결 문제는 포트가 아닌 **ACL 설정** 때문일 가능성이 높습니다.

---

## 디버깅 명령어

### Core Pod 상태 확인

```bash
# Pod 상태 확인
kubectl get pods -n unbrdn -l app=core

# Pod 상세 정보
kubectl describe pod <pod-name> -n unbrdn
```

### 로그 확인

```bash
# Core Pod 로그 확인
kubectl logs -l app=core -n unbrdn --tail=50

# 실시간 로그 확인
kubectl logs -f -l app=core -n unbrdn
```

### ConfigMap 및 Secret 확인

```bash
# ConfigMap 확인
kubectl get configmap core-config -n unbrdn -o yaml

# ConfigMap의 datasource-url 확인
kubectl get configmap core-config -n unbrdn -o jsonpath='{.data.datasource-url}' && echo ""

# Secret 확인 (비밀번호는 마스킹됨)
kubectl get secret oracle-db-credentials -n unbrdn -o yaml

# Secret 값 확인 (base64 디코딩 필요)
kubectl get secret oracle-db-credentials -n unbrdn -o jsonpath='{.data.username}' | base64 -d && echo ""
kubectl get secret oracle-db-credentials -n unbrdn -o jsonpath='{.data.password}' | base64 -d && echo ""
```

### Pod 재시작

```bash
# Deployment 재시작
kubectl rollout restart deployment core -n unbrdn

# 재시작 상태 확인
kubectl rollout status deployment core -n unbrdn
```

---

## 예상 원인 및 해결

### 1. ACL 규칙이 실제로 저장되지 않음

**증상:**
- 입력 필드에만 규칙이 있고 목록에 추가되지 않음
- "저장" 버튼을 클릭해도 에러 발생

**해결:**
- "액세스 제어 규칙 추가" 버튼 클릭 후 저장
- 목록에 규칙이 표시되는지 확인

### 2. ACL 변경사항이 아직 적용되지 않음

**증상:**
- ACL 규칙을 저장했지만 연결이 안 됨

**해결:**
- ACL 변경 후 5-10분 소요될 수 있음
- 몇 분 더 대기 후 재시도

### 3. 네트워크 방화벽 문제

**증상:**
- ACL 설정이 올바른데도 연결 실패
- `Connection reset` 또는 `Connection timeout` 오류

**해결:**
- Kubernetes 클러스터에서 Oracle DB로의 아웃바운드 연결 확인
- 네트워크 관리자에게 문의
- 특정 IP 주소를 ACL에 추가하여 테스트

### 4. Oracle DB 상태 문제

**증상:**
- 데이터베이스가 아직 완전히 준비되지 않음

**해결:**
- OCI 콘솔에서 데이터베이스 상태 확인 (Available이어야 함)
- 생성 직후인 경우 몇 분 더 대기

### 5. JDBC URL 오류

**증상:**
- 잘못된 URL 형식 오류

**해결:**
- Connection Strings에서 정확한 URL 확인
- Host, Port, Service Name이 올바른지 확인
- 포트는 1522 사용 (JDBC 표준)

### 6. 인증 실패

**증상:**
- `ORA-01017: invalid username/password` 오류

**해결:**
- Secret 값 확인 및 재생성
- 사용자 이름과 비밀번호가 올바른지 확인
- Oracle DB의 ADMIN 계정 비밀번호 확인

---

## 참고 사항

- Oracle Autonomous Database는 기본적으로 **보안을 위해 접근을 제한**합니다.
- "모든 곳에서 보안 액세스" 옵션을 선택해도 **ACL 설정이 필요**합니다.
- ACL 설정 후 변경 사항이 적용되는 데 **몇 분**이 소요될 수 있습니다.
- 프로덕션 환경에서는 특정 IP만 허용하는 것을 권장합니다.
- 자세한 설정 가이드는 [oracle-db-setup.md](./oracle-db-setup.md)를 참조하세요.

