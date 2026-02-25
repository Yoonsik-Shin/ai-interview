# 디스크 관리 및 용량 부족 해소 가이드

## 📋 목차

1. [현재 상태](#현재-상태)
2. [문제 증상 및 진단](#문제-증상-및-진단)
3. [5단계 해소 방법](#5단계-해소-방법)
4. [원인별 상세 해결](#원인별-상세-해결)
5. [모니터링 및 경고](#모니터링-및-경고)
6. [운영 정책](#운영-정책)
7. [예방 및 자동화](#예방-및-자동화)

---

## 현재 상태

### 디스크 사용량

```
시스템 파티션: /dev/disk3s5
├─ 전체 용량:     460Gi
├─ 사용량:        278Gi (66% - 안정적)
├─ 여유:          149Gi
└─ 상태:          ✅ 정상
```

### K8s 리소스 제한 (2026-01-12 적용)

| 구분              | 요청           | 제한           | 현황      |
| ----------------- | -------------- | -------------- | --------- |
| **CPU (unbrdn)**  | 3950m / 8 core | 16 / 16 core   | 49%       |
| **메모리**        | 7360Mi / 16Gi  | 17280Mi / 32Gi | 46% / 54% |
| **디스크 (PV)**   | 20Gi / 30Gi    | -              | 67%       |
| **임시 스토리지** | 1.3Gi / 10Gi   | 6.1Gi / 20Gi   | 13% / 31% |

---

## 문제 증상 및 진단

### 🚨 증상 1: Pod가 Pending 상태

```bash
$ kubectl get pods -n unbrdn
NAME                    READY   STATUS    RESTARTS   AGE
new-pod-xxxxx           0/1     Pending   0          5m
bff-xxxxxx              1/1     Running   0          10m
```

**진단:**

```bash
# 상세 이유 확인
kubectl describe pod new-pod-xxxxx -n unbrdn

# 출력 예시:
# Warning  FailedScheduling  3m  default-scheduler
#   0/5 nodes are available: 1 DiskPressure, 4 MemoryPressure, ...
```

### 🚨 증상 2: ResourceQuota 한계 도달

```bash
$ kubectl describe resourcequota unbrdn-resource-quota -n unbrdn

Resource                    Used     Hard
--------                    ----     ----
requests.ephemeral-storage  9.5Gi    10Gi    ⚠️ 95% 사용
limits.ephemeral-storage    19.8Gi   20Gi    ⚠️ 99% 사용
requests.storage            29.9Gi   30Gi    ⚠️ 99% 사용
```

### 🚨 증상 3: 노드 디스크 압박

```bash
$ kubectl top nodes
NAME                    CPU(cores)   CPU%   MEMORY(Mi)   MEMORY%
unbrdn-control-plane    1200m        12%    2048Mi       25%
unbrdn-worker           2000m        20%    4096Mi       40%

# 노드별 디스크 확인
for node in $(kubectl get nodes -o name | cut -d/ -f2); do
  echo "=== $node ==="
  kubectl debug node/$node -it --image=ubuntu -- df -h /
done
```

---

## 5단계 해소 방법

### 🔴 **Step 1: 긴급 정리 (5-10분, 20-30GB 확보)**

**실행:**

```bash
# 1. Docker 시스템 정리
docker system prune -af --volumes
# 출력: Total reclaimed space: 10.5GB

# 2. Kind 클러스터 노드 정리
./scripts/cleanup-disk.sh
# - 임시 파일 삭제
# - 오래된 로그 정리
# - 불필요한 이미지 제거

# 3. Pending Pod 강제 삭제 (필요시)
kubectl delete pod stuck-pod-xxx -n unbrdn --grace-period=0 --force
```

**결과 확인:**

```bash
docker system df
# 확보 공간 확인

kubectl describe resourcequota unbrdn-resource-quota -n unbrdn
# 여유 공간 재확인
```

---

### 🟠 **Step 2: 데이터 분석 및 원인 파악 (10-20분)**

#### **2-1. 로그 파일 확인**

```bash
# Pod별 로그 크기 확인
for pod in $(kubectl get pods -n unbrdn -o name | cut -d/ -f2); do
  echo "=== $pod ==="
  kubectl logs $pod -n unbrdn --tail=100 2>/dev/null | wc -c
done

# 노드 로그 확인
for node in $(kubectl get nodes -o name | cut -d/ -f2); do
  kubectl debug node/$node -it --image=ubuntu -- du -sh /var/log/
done
```

#### **2-2. 데이터베이스 크기 확인**

```bash
# PostgreSQL
kubectl exec -it postgres-xxxxx -n unbrdn -- \
  psql -U postgres -c \
  "SELECT datname, pg_size_pretty(pg_database_size(datname))
   FROM pg_database
   ORDER BY pg_database_size(datname) DESC;"

# 테이블별 크기
kubectl exec -it postgres-xxxxx -n unbrdn -- \
  psql -U postgres interview_db -c \
  "SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
   FROM pg_tables
   WHERE schemaname='public'
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

#### **2-3. Redis 메모리 확인**

```bash
# Redis 메모리 사용량
kubectl exec -it redis-0 -n unbrdn -- redis-cli INFO memory

# 출력 예시:
# used_memory: 1073741824 (1GB)
# used_memory_human: 1.00G
# maxmemory: 0 (무제한)
```

#### **2-4. emptyDir 볼륨 확인**

```bash
# emptyDir를 사용하는 Pod 확인
kubectl get pods -n unbrdn -o json | jq -r '.items[] |
  select(.spec.volumes[]?.emptyDir != null) | .metadata.name'

# 특정 Pod의 디스크 사용량
kubectl exec -it llm-xxxxx -n unbrdn -- du -sh /*
```

---

### 🟡 **Step 3: 원인별 정리 (20-40분)**

#### **원인 A: 로그 파일 폭증**

**현상:**

```
/var/log/xxx.log가 2-3GB 이상
```

**해결책:**

```bash
# 1. 즉시 정리
find /var/log -name "*.log" -mtime +7 -delete  # 7일 이상 된 로그

# 2. 영구 설정 (kubelet.conf)
containerLogMaxSize: 100Mi    # 파일당 최대 크기
containerLogMaxFiles: 3        # 유지할 최대 파일 수

# 3. Pod 로그 정책 설정 (Deployment)
spec:
  template:
    spec:
      containers:
      - name: app
        # 표준 출력 크기 제한
        stdout: regular
        stderr: regular
```

---

#### **원인 B: PostgreSQL 데이터 폭증**

**현상:**

```
interview_db가 3GB 이상
```

**진단:**

```bash
# 가장 큰 테이블 확인
kubectl exec -it postgres-xxxxx -n unbrdn -- \
  psql -U postgres interview_db -c \
  "SELECT schemaname, tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
   FROM pg_tables
   WHERE schemaname='public'
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 10;"
```

**해결책:**

```bash
# 1. 오래된 데이터 삭제 (90일 이상)
kubectl exec -it postgres-xxxxx -n unbrdn -- \
  psql -U postgres interview_db -c \
  "DELETE FROM interviews WHERE created_at < NOW() - INTERVAL '90 days';
   DELETE FROM interview_history WHERE created_at < NOW() - INTERVAL '90 days';
   VACUUM ANALYZE;"
```

```sql
-- 2. 불필요한 인덱스 제거
DROP INDEX IF EXISTS idx_old_index;

-- 3. 파티셔닝 적용 (대량 데이터)
-- interviews 테이블을 월별로 파티셔닝
CREATE TABLE interviews_2025_01 PARTITION OF interviews
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

```bash
# 4. 정기 유지보수
kubectl exec -it postgres-xxxxx -n unbrdn -- \
  psql -U postgres interview_db -c \
  "REINDEX DATABASE interview_db;
   ANALYZE;"
```

---

#### **원인 C: Redis 메모리 폭증**

**현상:**

```
Redis가 1GB 이상
```

**진단:**

```bash
# 메모리 상세 분석
kubectl exec -it redis-0 -n unbrdn -- redis-cli INFO memory

# 가장 큰 키 찾기
kubectl exec -it redis-0 -n unbrdn -- redis-cli --bigkeys
```

**해결책:**

```bash
# 1. 스냅샷 정책 최적화
# redis-sentinel.yaml 수정:
save 900 1       # 15분마다 1개 변경시만 저장 (이전: 자주)
save 300 10      # 5분마다 10개 변경시만 저장
save 60 10000    # 1분마다 10000개 변경시만 저장
```

```bash
# 2. 즉시 정리
kubectl exec -it redis-0 -n unbrdn -- redis-cli CONFIG SET maxmemory 2gb
kubectl exec -it redis-0 -n unbrdn -- redis-cli CONFIG SET maxmemory-policy allkeys-lru

# 3. RDB 최적화
kubectl exec -it redis-0 -n unbrdn -- redis-cli BGREWRITEAOF
```

---

#### **원인 D: 컨테이너 임시 파일 폭증**

**현상:**

```
특정 Pod의 /tmp가 1GB 이상
```

**해결책:**

```bash
# 1. 문제 Pod 재시작 (emptyDir 초기화)
kubectl delete pod llm-xxxxx -n unbrdn

# 2. 영구 설정 (Deployment에 sizeLimit 추가)
spec:
  template:
    spec:
      volumes:
      - name: temp-storage
        emptyDir:
          sizeLimit: 500Mi  # 최대 500MB로 제한

      containers:
      - name: llm
        volumeMounts:
        - name: temp-storage
          mountPath: /tmp
```

---

### 🟢 **Step 4: 구조적 개선 (1-2시간)**

#### **개선 1: 자동 정리 CronJob 추가**

```yaml
# docs/k8s/cleanup-cron.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: disk-cleanup
  namespace: unbrdn
spec:
  # 매일 새벽 2시 자동 정리
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: cleanup-service-account
          containers:
            - name: cleanup
              image: ubuntu:22.04
              command:
                - /bin/bash
                - -c
                - |
                  apt-get update && apt-get install -y postgresql-client

                  # 1. 로그 정리
                  echo "Cleaning logs..."
                  find /var/log -name "*.log" -mtime +7 -delete

                  # 2. PostgreSQL 정리
                  echo "Cleaning old interview data..."
                  PGPASSWORD=$DB_PASSWORD psql \
                    -h postgres \
                    -U postgres \
                    -d interview_db \
                    -c "DELETE FROM interviews WHERE created_at < NOW() - INTERVAL '90 days';"

                  # 3. VACUUM
                  PGPASSWORD=$DB_PASSWORD psql \
                    -h postgres \
                    -U postgres \
                    -d interview_db \
                    -c "VACUUM ANALYZE;"
              env:
                - name: DB_PASSWORD
                  valueFrom:
                    secretKeyRef:
                      name: postgres-credentials
                      key: password
          restartPolicy: OnFailure
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
```

#### **개선 2: PVC 자동 확장 설정**

```yaml
# k8s/infra/storage-class.yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/docker
allowVolumeExpansion: true # 자동 확장 허용
parameters:
  replication-factor: "1"
```

**수동 확장:**

```bash
# PVC 크기 2Gi → 5Gi로 확장
kubectl patch pvc postgres-data-pvc -n unbrdn \
  -p '{"spec":{"resources":{"requests":{"storage":"5Gi"}}}}'

# 확인
kubectl get pvc -n unbrdn postgres-data-pvc
```

---

### 🔵 **Step 5: 모니터링 및 경고 (1-2시간)**

#### **설정 1: Prometheus 알람**

```yaml
# k8s/infra/monitoring/prometheus-rules.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: disk-usage-alert
  namespace: monitoring
spec:
  groups:
    - name: disk-alerts
      interval: 30s
      rules:
        # 디스크 사용량 경고
        - alert: NodeDiskSpaceWarning
          expr: |
            (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.3
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Node {{ $labels.node }} 디스크 사용량 높음 (70% 이상)"
            description: "여유 공간: {{ $value | humanizePercentage }}"

        # 디스크 위험 상황
        - alert: NodeDiskSpaceCritical
          expr: |
            (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.1
          for: 1m
          labels:
            severity: critical
          annotations:
            summary: "Node {{ $labels.node }} 디스크 위험 상태!"
            description: "여유 공간: {{ $value | humanizePercentage }}"

        # ResourceQuota 한계
        - alert: NamespaceDiskPressure
          expr: |
            (kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes) > 0.9
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "Namespace {{ $labels.namespace }} 디스크 거의 가득 참 (90%)"
            description: "PVC: {{ $labels.persistentvolumeclaim }} - 사용: {{ $value }}"

        # 데이터베이스 크기
        - alert: PostgreSQLDatabaseTooLarge
          expr: |
            pg_database_size_bytes / 1024 / 1024 / 1024 > 5
          for: 10m
          labels:
            severity: warning
          annotations:
            summary: "PostgreSQL {{ $labels.datname }} 데이터베이스 5GB 초과"
            description: "현재 크기: {{ $value }}GB"
```

**적용:**

```bash
kubectl apply -f k8s/infra/monitoring/prometheus-rules.yaml
```

---

#### **설정 2: 간단한 모니터링 스크립트**

```bash
# scripts/monitor-disk.sh
#!/bin/bash

THRESHOLD_WARNING=80
THRESHOLD_CRITICAL=90

# 로컬 디스크 확인
USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')

echo "=== Disk Usage Report ==="
echo "Local Disk: ${USAGE}%"

if [ $USAGE -ge $THRESHOLD_CRITICAL ]; then
  echo "🔴 CRITICAL - Immediate action required!"
  kubectl describe resourcequota unbrdn-resource-quota -n unbrdn
elif [ $USAGE -ge $THRESHOLD_WARNING ]; then
  echo "🟠 WARNING - Monitor closely"
else
  echo "🟢 OK"
fi

# Kubernetes 리소스 확인
echo ""
echo "=== K8s ResourceQuota ==="
kubectl describe resourcequota unbrdn-resource-quota -n unbrdn

# 데이터베이스 크기
echo ""
echo "=== Database Size ==="
kubectl exec -it postgres-$(kubectl get pods -n unbrdn -l app=postgres -o name | head -1 | cut -d/ -f2) -n unbrdn -- \
  psql -U postgres -c "SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database ORDER BY pg_database_size(datname) DESC;" 2>/dev/null || echo "PostgreSQL 접근 불가"
```

**실행:**

```bash
chmod +x scripts/monitor-disk.sh
./scripts/monitor-disk.sh

# crontab에 추가 (매일 아침 8시)
0 8 * * * /path/to/scripts/monitor-disk.sh >> /var/log/disk-report.log 2>&1
```

---

## 운영 정책

### 디스크 사용량 정책

| 수준     | 사용량 | 상태 | 조치                           |
| -------- | ------ | ---- | ------------------------------ |
| **정상** | 0-70%  | 🟢   | 모니터링만 진행                |
| **주의** | 70-80% | 🟡   | 경고 발송, 불필요한 Pod 정리   |
| **경고** | 80-90% | 🟠   | 자동 정리 시작, 수동 개입 준비 |
| **위험** | 90%+   | 🔴   | 긴급 조치 필요                 |

### 담당자별 역할

| 담당자      | 용량 | 조치                           |
| ----------- | ---- | ------------------------------ |
| **DevOps**  | 80%  | 경고 메시지 발송, 팀 공지      |
| **DBA**     | 85%  | 데이터베이스 정리 검토         |
| **시스템**  | 90%  | 자동 정리 스크립트 실행        |
| **On-call** | 95%  | 긴급 대응 (Pod 강제 삭제 포함) |

---

## 예방 및 자동화

### 정기 유지보수 일정

```bash
# 매주 일요일 자정 - 데이터베이스 최적화
0 0 * * 0 kubectl exec postgres-xxxxx -n unbrdn -- \
  psql -U postgres interview_db -c "VACUUM ANALYZE; REINDEX DATABASE interview_db;"

# 매달 1일 - 오래된 데이터 삭제
0 3 1 * * kubectl exec postgres-xxxxx -n unbrdn -- \
  psql -U postgres interview_db -c "DELETE FROM interviews WHERE created_at < NOW() - INTERVAL '90 days';"

# 매달 15일 - 데이터베이스 백업
0 2 15 * * kubectl exec postgres-xxxxx -n unbrdn -- \
  pg_dump -U postgres interview_db | gzip > /backup/interview_$(date +\%Y\%m\%d).sql.gz

# 매일 오전 6시 - 디스크 리포트
0 6 * * * ./scripts/monitor-disk.sh >> /var/log/disk-report.log 2>&1
```

### 체크리스트

- [ ] ResourceQuota 모니터링 설정 완료
- [ ] Prometheus 알람 규칙 적용
- [ ] CronJob 자동 정리 실행 중
- [ ] 주간 수동 점검 일정 수립
- [ ] 긴급 연락처 등록

---

## 트러블슈팅

### Q: Pod가 Pending 상태에서 움직이지 않음

```bash
# 진단
kubectl describe pod stuck-pod -n unbrdn

# 해결
# 1. 리소스 요청 확인
kubectl get pod stuck-pod -n unbrdn -o json | jq '.spec.containers[].resources'

# 2. ResourceQuota 확인
kubectl describe resourcequota unbrdn-resource-quota -n unbrdn

# 3. 다른 Pod 정리 후 재시도
kubectl delete pod low-priority-pod -n unbrdn

# 4. Pod 강제 재시작
kubectl delete pod stuck-pod -n unbrdn --grace-period=0 --force
```

### Q: 디스크는 여유인데 Pod가 생성 안 됨

```bash
# 노드 상태 확인
kubectl describe nodes

# Ready 상태가 DiskPressure면 노드 정리
kubectl debug node/worker-1 -it --image=ubuntu -- \
  rm -rf /var/lib/kubelet/pods/*/volume-subpaths/*
```

### Q: PostgreSQL이 느려짐

```bash
# 1. 크기 확인
kubectl exec -it postgres-xxxxx -n unbrdn -- \
  psql -U postgres -c "SELECT pg_size_pretty(pg_database_size('interview_db'));"

# 2. 오래된 데이터 삭제
kubectl exec -it postgres-xxxxx -n unbrdn -- \
  psql -U postgres interview_db -c \
  "DELETE FROM interviews WHERE created_at < NOW() - INTERVAL '60 days';"

# 3. 최적화
kubectl exec -it postgres-xxxxx -n unbrdn -- \
  psql -U postgres interview_db -c "VACUUM ANALYZE;"
```

---

## 참고 문서

- [K8s ResourceQuota](https://kubernetes.io/docs/concepts/policy/resource-quotas/)
- [K8s Storage Classes](https://kubernetes.io/docs/concepts/storage/storage-classes/)
- [PostgreSQL Performance Tuning](https://www.postgresql.org/docs/current/sql-vacuum.html)
- [Redis Memory Management](https://redis.io/topics/memory-optimization)

---

**마지막 업데이트**: 2026-01-12  
**상태**: ✅ 정상 (66% 사용)
