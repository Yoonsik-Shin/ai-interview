# 운영·배포 통합 문서 (Deployment & Operations)

생성일: 2026-01-10

목적: 프로젝트의 운영 및 배포 관련 핵심 정보를 한 곳에 요약합니다. 아키텍처와 관련된 상세 내용은 [아키텍처 통합 문서](../architecture/architecture.md)를 참조하세요.

## 핵심 요약

- 로컬: `kind` 2-worker 구성(상세: `k8s/kind-cluster-config.yaml`), 이미지 빌드 스크립트: `scripts/build-images-local.sh`
- 프로덕션: OCI OKE, Pool A/B/C 전략 (Pool A: 안정, Pool B: preemptible, Pool C: Triton/GPU)
- 시크릿/환경변수: `llm-secrets`, `oracle-db-credentials`, `ocir-secret`, `JWT_SECRET` 등
- 배포 흐름(간단): 빌드 → 레지스트리에 푸시 → `kubectl apply -f k8s/apps/<service>/prod/`

## 배포 파이프라인 요약

- 로컬: `./scripts/build-images-local.sh` → `kind load docker-image <image>:local --name kind` → `kubectl apply -f k8s/apps/<service>/local/`
- 프로덕션: CI 빌드/푸시(OCIR) → `kubectl apply -f k8s/apps/<service>/prod/` → `kubectl rollout status ...`
- LLM 단독 변경 시: `k8s/apps/llm/prod/`만 적용 후 Socket/BFF 롤링 불필요

## Docker 관련 참고

상세한 Docker 최적화 기법 및 이미지 빌드 전략은 관련 문서나 아키텍처 문서를 참고하세요.

## 체크리스트(상태 확인용)

- 클러스터: 노드 라벨(`pool=main|infra|triton`) 확인
- PVC, ConfigMap, Secret 존재 여부 확인
- Kafka/Redis 상태: Strimzi, Redis Sentinel 정상 동작
- 이미지 태그 정책: `IfNotPresent`(로컬) vs 레지스트리 태깅(프로덕션)

## 환경변수 / 시크릿 스냅샷

- BFF: `CORE_GRPC_URL`, `LLM_GRPC_URL`(또는 호환 `INFERENCE_GRPC_URL`), `JWT_SECRET`, `KAFKA_BROKER`, `REDIS_HOST/PORT`
- Core: `CORE_GRPC_PORT`, DB 접속(Oracle/PG), Kafka 토픽 설정
- LLM: `OPENAI_API_KEY`, `GRPC_PORT`(50051), Kafka/Redis, Edge-TTS 사용 시 외부 네트워크 허용 확인
- 공통: `ocir-secret`(prod), 로컬은 시크릿 예제(`k8s/apps/llm/local/secret.yaml.example`) 참고

## 빠른 명령 예시

```bash
# 로컬 이미지 빌드
./scripts/build-images-local.sh

# kind에 이미지 로드
kind load docker-image llm:local --name kind

# 매니페스트 적용
kubectl apply -f k8s/apps/llm/local/ -n unbrdn
kubectl rollout status deployment/llm -n unbrdn
```

## 롤아웃 검증 & 운영 팁

- 헬스체크: `kubectl get pods -n unbrdn -o wide` → 레디니스/라벨 배치 확인
- gRPC 확인: 포트포워딩 후 `grpcurl -plaintext localhost:50051 list`
- 로그: `kubectl logs deploy/llm -n unbrdn -f --tail=200` (Edge/OpenAI 호출 오류 여부 확인)
- Kafka 상태: `kubectl -n kafka get kafka` 또는 Strimzi 리소스 이벤트 확인

## Incidents & Fixes (요약)

- Core → Oracle DB 연결 실패 (ORA-17002): ACL/네트워크/Secret 점검. 임시 연결 테스트와 Hikari 설정 조정 권장.
  - 테스트: `sqlplus`로 임시 Pod에서 접속 확인, ADB Network ACL 검증
  - 재시작: `kubectl rollout restart deployment core -n unbrdn`
- LLM OPENAI_API_KEY 누락: `llm-secrets` 생성 후 재시작, 헬스엔드포인트 `/health` 확인
  - Secret: `kubectl create secret generic llm-secrets --from-literal=OPENAI_API_KEY=... -n unbrdn --dry-run=client -o yaml | kubectl apply -f -`
  - 헬스: `kubectl port-forward -n unbrdn svc/llm 8000:8000 &` → `curl http://localhost:8000/health`
- Pending Pod(리소스 부족): 이전 ReplicaSet/Pod 정리, 임시 스케일 다운, 리소스 요청 조정
  - 스케일: `kubectl scale deployment llm -n unbrdn --replicas=1`
  - 리소스: `requests.cpu: 100m`, `requests.memory: 512Mi` 등으로 조정
- Liveness Probe 404: 초기 지연/타임아웃 상향, 포트 확인(예: 8000), Readiness Probe 병행
  - Probe 예시: `initialDelaySeconds: 60`, `failureThreshold: 5`

## 권장 유지관리

- 모니터링: Prometheus + Grafana 대시보드 (Kafka/Redis/Uvicorn 메트릭)
- 백업: Kafka 토픽 오프로드, Redis AOF 주기적 백업
- 보안: TLS(ingress), OCI Vault 또는 sealed-secrets 사용 권장

참고 원본: [환경 변수 가이드](../guide/environment-variables.md), [아키텍처 통합 문서](../architecture/architecture.md)
