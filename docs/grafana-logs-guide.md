# Grafana 로그 확인 가이드

## 1. Loki 데이터 소스 추가

1. Grafana 접속: `http://localhost/grafana` (로컬) 또는 `https://unbrdn.me/grafana` (프로덕션)
2. 로그인: `admin` / `admin`
3. 좌측 메뉴: **Configuration** → **Data Sources** → **Add data source**
4. **Loki** 선택
5. URL 입력: `http://loki:3100` (클러스터 내부 서비스 이름)
6. **Save & Test** 클릭

## 2. 로그 확인 방법

### 방법 1: Explore 메뉴 사용 (실시간 로그 확인)

1. 좌측 메뉴에서 **Explore** 클릭
2. 데이터 소스: **Loki** 선택
3. LogQL 쿼리 입력:

**중요**: Explore에서 여러 쿼리 패널(A, B)은 **각각 독립적으로 실행**됩니다. AND 조건이 아닙니다. 결과가 별도로 표시됩니다.

#### 모든 Pod 로그 보기

```logql
{job="kubernetes-pods"}
```

#### 특정 Pod 로그 보기 (예: core 서비스)

```logql
{job="kubernetes-pods"} |= "core"
```

#### 특정 네임스페이스 로그 보기

```logql
{job="kubernetes-pods", namespace="unbrdn"}
```

#### 에러 로그만 보기 (권장: 단일 쿼리로 통합)

```logql
{job="kubernetes-pods"} |~ "(?i)error|exception|failed"
```

#### 특정 서비스의 에러 로그 (AND 조건 - 하나의 쿼리로)

```logql
{job="kubernetes-pods"} |= "core" |~ "(?i)error|exception|failed"
```

### 방법 1-1: 보기 좋은 쿼리 구성 방법

#### ✅ 권장: 단일 쿼리로 필터링 (AND 조건)

하나의 쿼리에 모든 조건을 포함하면 AND 조건으로 작동합니다:

```logql
# Core 서비스의 에러 로그만 (AND 조건)
{job="kubernetes-pods", container="core"} |~ "(?i)error|exception|failed"
```

```logql
# 특정 시간대의 에러 로그 (AND 조건)
{job="kubernetes-pods", namespace="unbrdn"} |~ "(?i)error" | json
```

#### ❌ 비권장: 여러 패널 사용 (독립 실행)

패널 A와 B를 따로 사용하면 각각 독립적으로 실행되어 결과가 분리됩니다:

- 패널 A: `{service_name="kubernetes-pods"}` → 모든 로그
- 패널 B: `{job="kubernetes-pods"} |~ "error"` → 에러 로그만

이 경우 두 결과가 **별도로 표시**되므로 비교하기 어렵습니다.

#### ✅ 권장: Split View 사용

1. **Split** 버튼 클릭
2. 패널 A: 전체 로그
3. 패널 B: 필터링된 로그 (에러만)
4. 두 패널을 나란히 비교 가능

#### 시간 범위 필터링

- 우측 상단에서 시간 범위 선택 (예: Last 15 minutes, Last 1 hour)

### 방법 2: 대시보드 생성 (권장: 보기 좋게 구성)

#### 단계별 가이드

1. **Dashboards** → **New Dashboard** → **Add visualization**
2. 데이터 소스: **Loki** 선택
3. LogQL 쿼리 입력
4. 패널 설정:
   - **Visualization**: **Logs** 선택
   - **Time range**: 원하는 시간 범위 설정
   - **Line limit**: 1000 (기본값, 필요시 조정)

#### ✅ 권장 대시보드 구성

**패널 1: 전체 서비스 로그 개요**

```logql
{job="kubernetes-pods", namespace="unbrdn"} | json
```

- Visualization: **Logs**
- Show time: ✅
- Show labels: ✅ (container, pod)

**패널 2: 에러 로그 집계**

```logql
sum(count_over_time({job="kubernetes-pods"} |~ "(?i)error" [5m]))
```

- Visualization: **Time series** 또는 **Stat**
- 서비스별 에러 카운트 확인

**패널 3: 서비스별 로그 분포**

```logql
sum by (container) (count_over_time({job="kubernetes-pods"}[5m]))
```

- Visualization: **Time series**
- 각 서비스의 로그 발생량 추이

**패널 4: Core 서비스 상세 로그**

```logql
{job="kubernetes-pods", container="core"} | json
```

- Visualization: **Logs**
- Core 서비스만 필터링

**패널 5: 에러 로그 상세**

```logql
{job="kubernetes-pods"} |~ "(?i)error|exception|failed" | json
```

- Visualization: **Logs**
- 모든 에러 로그만 표시

## 3. 유용한 LogQL 쿼리 예시 (보기 좋게 구성)

### ✅ 권장: 서비스별 로그 (JSON 파싱 포함)

```logql
# Core 서비스 전체 로그 (JSON 파싱으로 구조화)
{job="kubernetes-pods", container="core"} | json
```

```logql
# BFF 서비스 전체 로그
{job="kubernetes-pods", container="bff"} | json
```

```logql
# Socket 서비스 전체 로그
{job="kubernetes-pods", container="socket"} | json
```

```logql
# Inference 서비스 전체 로그
{job="kubernetes-pods", container="inference"} | json
```

### ✅ 권장: 에러 로그 (서비스별 필터링)

```logql
# Core 서비스 에러만 (AND 조건)
{job="kubernetes-pods", container="core"} |~ "(?i)error|exception|failed" | json
```

```logql
# Oracle DB 에러 로그 (AND 조건)
{job="kubernetes-pods"} |~ "(?i)ora-00904|ora-|oracle|jdbc.*error" | json
```

```logql
# 전체 서비스의 에러 로그 (한눈에 보기)
{job="kubernetes-pods", namespace="unbrdn"} |~ "(?i)error|exception|failed" | json
```

### ✅ 권장: HTTP 요청 로그

```logql
# BFF HTTP 요청 로그 (AND 조건)
{job="kubernetes-pods", container="bff"} |~ "GET|POST|PUT|DELETE|PATCH" | json
```

```logql
# API 에러 응답만 (AND 조건)
{job="kubernetes-pods", container="bff"} |~ "statusCode.*[45][0-9]{2}" | json
```

### ✅ 권장: Kafka 관련 로그

```logql
# Kafka 관련 로그 (AND 조건)
{job="kubernetes-pods"} |~ "(?i)kafka|topic|consumer|producer" | json
```

### ✅ 권장: 특정 에러 코드 검색

```logql
# Oracle ORA-00904 에러만
{job="kubernetes-pods"} |~ "ORA-00904" | json
```

```logql
# 500 에러만
{job="kubernetes-pods"} |~ "statusCode.*500" | json
```

## 4. Pod 정보 확인 방법

### ✅ Grafana에서 Pod 정보 보는 방법

**방법 1: Common Labels 활성화 (가장 쉬움)**

1. 우측 설정 패널 → **Logs** 섹션
2. **Common labels** 옵션을 **ON**으로 설정
3. 로그 상단에 Pod 이름, 컨테이너 이름 등이 표시됩니다

**방법 2: Label Browser 사용**

1. 쿼리 입력창 옆의 **"Label browser"** 버튼 클릭
2. `pod`, `container`, `namespace` 등의 레이블 선택
3. 원하는 Pod/컨테이너 선택 후 쿼리 자동 생성

**방법 3: 로그 상세 보기**

1. 로그 라인 클릭
2. **Log details** 패널에서 `pod`, `container`, `namespace`, `node` 확인

**방법 4: 쿼리에 레이블 직접 추가**

### Pod 이름으로 필터링

```logql
{job="kubernetes-pods", pod="core-xxx-xxx"}
```

### 컨테이너 이름으로 필터링

```logql
{job="kubernetes-pods", container="core"}
```

### 네임스페이스로 필터링

```logql
{job="kubernetes-pods", namespace="unbrdn"}
```

### 특정 서비스의 Pod 로그

```logql
{job="kubernetes-pods", container="core", namespace="unbrdn"}
```

### 여러 Pod 동시 확인

```logql
{job="kubernetes-pods", pod=~"core-.*|bff-.*"}
```

## 5. 로그 파싱 및 필터링

### JSON 로그 파싱

```logql
{job="kubernetes-pods"} | json | level="error"
```

### 특정 필드 추출

```logql
{job="kubernetes-pods"} | json | message=~".*error.*"
```

### 로그 라인 필터링

```logql
{job="kubernetes-pods"} |~ "password|secret|token" != "password"
```

## 6. 문제 해결

### Loki 연결 실패 시

```bash
# Loki Pod 상태 확인
kubectl get pods -n unbrdn | grep loki

# Loki 로그 확인
kubectl logs -n unbrdn -l app=loki

# Loki 서비스 확인
kubectl get svc -n unbrdn | grep loki
```

### Promtail 로그 수집 확인

```bash
# Promtail Pod 상태 확인
kubectl get pods -n unbrdn | grep promtail

# Promtail 로그 확인
kubectl logs -n unbrdn -l app=promtail
```

### 로그가 보이지 않을 때

1. Promtail이 모든 노드에서 실행 중인지 확인
2. Loki가 정상적으로 실행 중인지 확인
3. Pod 로그 경로가 올바른지 확인 (`/var/log/containers/*.log`)

## 7. 고급 기능

### 로그 집계 (Log Volume)

```logql
sum(count_over_time({job="kubernetes-pods"}[5m]))
```

### 에러 로그 카운트

```logql
sum(count_over_time({job="kubernetes-pods"} |~ "(?i)error" [5m]))
```

### 서비스별 로그 분포

```logql
sum by (container) (count_over_time({job="kubernetes-pods"}[5m]))
```
