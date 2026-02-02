# Scripts 가이드

이 디렉토리에는 프로젝트 빌드, 배포, 유지보수를 위한 스크립트들이 포함되어 있습니다. 각 스크립트의 역할, 사용법, 주의사항을 아래에서 확인할 수 있습니다.

## 목차

- [스크립트 구조](#-스크립트-구조)
- [빌드 및 배포](#-빌드-및-배포-스크립트)
- [인프라 설정](#-인프라-설정-스크립트)
- [Proto 파일 관리](#-proto-파일-관리-스크립트)
- [유틸리티](#-유틸리티-스크립트)
- [인증 및 보안](#-인증-및-보안-스크립트)
- [프론트엔드](#-프론트엔드-스크립트)
- [사용 워크플로우](#-사용-워크플로우)
- [공통 주의사항](#-공통-주의사항)

## 🔧 스크립트 구조

```
scripts/
├── build-images-local.sh       # 로컬 이미지 빌드
├── build-images-prod.sh        # 프로덕션 이미지 빌드
├── deploy-local.sh             # 로컬 배포
├── deploy-prod.sh              # 프로덕션 배포
├── setup-kind-local.sh         # Kind 클러스터 설정
├── setup-strimzi-local.sh      # Strimzi Operator 설정
├── setup-oracle-db.sh          # Oracle DB 설정
├── compile-proto.sh            # Proto 컴파일 (통합)
├── buf-generate.sh             # Buf 코드 생성
├── buf-push.sh                 # Buf 푸시
├── cleanup.sh                  # 정리 스크립트 (통합)
├── debug.sh                    # 디버깅 스크립트 (통합)
├── debug-kafka-local.sh        # Kafka 로컬 진단 (Kind + Strimzi)
├── check-image-sizes.sh        # 이미지 크기 확인
├── generate-jwt-keys.sh        # JWT 키 생성
├── generate-self-signed-cert.sh  # 인증서 생성
└── upload-frontend.sh          # 프론트엔드 업로드
```

---

## 📦 빌드 및 배포 스크립트

### `build-images-local.sh`

**역할:** 로컬 개발 환경용 Docker 이미지 빌드. 모든 서비스 또는 선택한 서비스만 빌드 가능. 호스트 아키텍처 자동 감지 (M1/M2 Mac), BuildKit 캐시, 병렬 빌드. Kind 클러스터가 활성 컨텍스트면 자동 이미지 로드.

**대상 서비스:** bff, core, llm, socket, stt, tts, storage

```bash
./scripts/build-images-local.sh                    # 모든 서비스 (latest)
./scripts/build-images-local.sh bff core           # 특정 서비스만
./scripts/build-images-local.sh v1.0.0 bff core    # 태그 지정
```

**특징:** 실시간 진행 표시, 빌드 시간 기록/예상, 실패 시 상세 로그, 완료 후 인터랙티브 메뉴.

**주의:** Docker 및 BuildKit 필요. Core는 `BUILD_PROFILE=local`로 빌드됨.

---

### `build-images-prod.sh`

**역할:** 프로덕션 Docker 이미지 빌드 및 레지스트리 푸시. 멀티 플랫폼(linux/amd64, linux/arm64) 지원.

```bash
./scripts/build-images-prod.sh [REGISTRY] [TAG] [PLATFORMS]
./scripts/build-images-prod.sh icn.ocir.io/axabcdefgh v1.0.0
```

**환경 변수:** `.env`에서 `IMAGE_REGISTRY`, `IMAGE_TAG` 로드. `REPO_BFF`, `REPO_CORE` 등으로 레포 이름 커스터마이징 가능.

**주의:** 레지스트리 인증 필요. Core는 `BUILD_PROFILE=prod`로 빌드됨.

---

### `deploy-local.sh`

**역할:** 로컬 Kind 클러스터에 전체 스택 배포. 인프라(PostgreSQL, Redis, Kafka), 앱 서비스, 모니터링(Prometheus, Grafana, Loki) 포함. 환경 검증 및 이미지 빌드 제안.

**배포 순서:** 네임스페이스 → Strimzi 확인 → PostgreSQL → Redis Sentinel(3대) → Kafka(Strimzi 3노드) → inference, core, bff, socket → 자체 서명 인증서 → Ingress → 모니터링.

```bash
./scripts/deploy-local.sh
```

**자동 기능:** Kind/Strimzi 없으면 설치 제안, 이미지 없으면 빌드 제안, 실패 Pod 정리.

**주의:** Kind(`kind-unbrdn-local`) 필요. 로컬 이미지 `latest` 필요. Inference Secret(OpenAI API 키) 필요.

---

### `deploy-prod.sh`

**역할:** 프로덕션 OCI OKE 클러스터 배포. envsubst로 환경 변수 치환.

```bash
./scripts/deploy-prod.sh [IMAGE_REGISTRY] [IMAGE_TAG]
```

**환경 변수:** `.env`에서 `IMAGE_REGISTRY`, `IMAGE_TAG`, `NAMESPACE`, `OCI_KE_CONTEXT` 로드.

**배포 순서:** OKE 컨텍스트 전환 → Strimzi → Redis Sentinel → Kafka → ConfigMap/Secret → core, llm, bff, socket → 모니터링 → Cert-Manager → ClusterIssuer → Ingress.

**주의:** OCI OKE 권한, `.env` 설정, Ingress 도메인·ClusterIssuer 이메일 설정 필요.

---

## 🏗️ 인프라 설정 스크립트

### `setup-kind-local.sh`

**역할:** 로컬 Kind 멀티 노드 클러스터 생성. 4-Node(Control Plane + Worker 3), **2 vCPU 8GB × 3** 워커 목표.

```bash
./scripts/setup-kind-local.sh
```

**구성:** `k8s/kind-cluster-config.yaml`, 클러스터명 `unbrdn`. Worker 3대 동일 main, Kafka/Redis 분산·HA.

**주의:** Kind 설치(`brew install kind`), Docker Desktop 실행 필요.

---

### `setup-strimzi-local.sh`

**역할:** Strimzi Kafka Operator 설치. Kafka 클러스터 관리용.

```bash
./scripts/setup-strimzi-local.sh
```

**주의:** Kubernetes 연결 필요. `kafka` 네임스페이스 자동 생성.

---

### `setup-oracle-db.sh`

**역할:** Oracle Autonomous DB 연결 설정. Secret·ConfigMap 생성, JDBC URL 자동 생성.

```bash
./scripts/setup-oracle-db.sh [NAMESPACE] [ORACLE_HOST] [ORACLE_SERVICE_NAME] [ORACLE_USERNAME] [ORACLE_PASSWORD]
```

**생성 리소스:** Secret `oracle-db-credentials`, ConfigMap `core-config`(datasource-url, kafka-bootstrap-servers).

**주의:** Oracle 연결 정보 필요. OCI Connection Strings에서 확인.

---

## 📝 Proto 파일 관리 스크립트

### `compile-proto.sh`

**역할:** `services/proto`의 Proto를 각 서비스별 컴파일. Python(LLM, STT), Java(Core), Node(BFF, Socket) 지원. TypeScript 타입 생성 옵션.

```bash
./scripts/compile-proto.sh              # 기본 (Python, Java)
./scripts/compile-proto.sh --typescript # TS 타입 포함 (-t 동일)
```

**대상:** LLM/STT → `*_pb2.py`, `*_pb2_grpc.py`; Core → Gradle `generateProto`; BFF/Socket → 런타임 로드.

**TS 출력:** `services/proto/generated/ts`. `protoc`, `protoc-gen-ts_proto` 필요.

---

### `buf-generate.sh`

**역할:** Buf로 Proto 코드 생성. lint → build → generate.

```bash
./scripts/buf-generate.sh
```

**생성 위치:** Core(Java), BFF/Socket(TS), LLM(Python) 각 generated 디렉터리.

**주의:** Buf 설치, `buf.yaml` 필요.

---

### `buf-push.sh`

**역할:** Buf Schema Registry에 Proto 푸시.

```bash
./scripts/buf-push.sh
```

**주의:** Buf Schema Registry 인증, `buf.yaml` 모듈 설정 필요.

---

## 🧹 유틸리티 스크립트

### `cleanup.sh`

**역할:** 클러스터 정리 통합. 실패/종료 Pod 정리, (`--all` 시) 디스크 정리.

```bash
./scripts/cleanup.sh              # 실패 Pod만 (기본)
./scripts/cleanup.sh --all        # Pod + 디스크 (-a 동일)
./scripts/cleanup.sh unbrdn       # 특정 NS만
./scripts/cleanup.sh --all unbrdn # 특정 NS 전체 정리
```

**정리 대상 Pod:** Failed, Unknown, Succeeded, Evicted, ContainerStatusUnknown.

**--all 시:** `docker system prune`, Kind 노드 내 임시/로그(7일+), containerd 이미지 정리.

**주의:** `--all`은 Docker 리소스 삭제 가능. 프로덕션에서 사용 시 주의. 확인 후 진행.

---

### `debug.sh`

**역할:** 클러스터 디버깅·진단. Pod 상태/이벤트/로그, (`--resources` 시) 리소스 사용량·할당량.

```bash
./scripts/debug.sh [NAMESPACE]              # Pod 진단
./scripts/debug.sh [NAMESPACE] --resources  # Pod + 리소스 (-r 동일)
```

**진단 내용:** Pod 목록, Core Pod 이벤트/이미지/로그, Deployment, ConfigMap·Secret. `--resources` 시 노드 할당량, Pod 요청/제한, `kubectl top`(metrics-server 필요), 리소스 부족 해결 팁.

**주의:** `jq` 있으면 상세 출력. metrics-server 필요 시 실제 사용량 확인 가능.

---

### `debug-kafka-local.sh`

**역할:** 로컬 Kind 환경에서 Kafka Pool 미기동 시 진단. StorageClass, Kafka CR/NodePool, PVC, Strimzi Operator 로그·이벤트 확인.

```bash
./scripts/debug-kafka-local.sh
```

**진단 내용:** default StorageClass, `kafka`/`kafkanodepool` 상태, Pod/PVC, Operator 로그 및 이전 크래시 로그, 최근 이벤트. `deploy-local` Kafka 타임아웃 시 안내에서 실행 권장.

**주의:** Kind + Strimzi 로컬 구성 기준. default StorageClass 없음·Operator 재시작·PVC Pending 등 흔한 원인 확인.

---

### `check-image-sizes.sh`

**역할:** Docker 이미지 크기 확인 및 레이어 분석.

```bash
./scripts/check-image-sizes.sh           # 기본
./scripts/check-image-sizes.sh --detailed  # 상세 (-d)
./scripts/check-image-sizes.sh --layers   # 레이어 (-l)
```

**대상:** bff, core, llm, socket. `numfmt` 사용(일부 시스템).

---

## 🔐 인증 및 보안 스크립트

### `generate-jwt-keys.sh`

**역할:** JWT용 RSA 키 쌍 생성. Private/Public PEM + 환경 변수 형식 출력.

```bash
./scripts/generate-jwt-keys.sh [OUT_DIR] [KID]
```

**출력:** `OUT_DIR/private.pem`, `public.pem` 및 `JWT_KEY_0_KID`, `JWT_KEY_0_PRIVATE_KEY`, `JWT_KEY_0_PUBLIC_KEY`, `JWT_KEY_0_ACTIVE`.

**주의:** OpenSSL 필요. Private 키 안전 보관.

---

### `generate-self-signed-cert.sh`

**역할:** 로컬용 자체 서명 TLS 인증서 생성 후 K8s Secret 등록.

```bash
./scripts/generate-self-signed-cert.sh
```

**리소스:** Secret `tls-secret`, NS `unbrdn`, 도메인 `localhost`, 365일.

**주의:** 브라우저 "안전하지 않음" 경고. 프로덕션에서는 Cert-Manager·Let's Encrypt 사용.

---

## 🌐 프론트엔드 스크립트

### `upload-frontend.sh`

**역할:** 프론트엔드 빌드 후 MinIO/Object Storage 업로드.

```bash
./scripts/upload-frontend.sh
```

**순서:** `pnpm install` → `pnpm build` → `frontend` 버킷에 `dist/` 업로드.

**환경 변수:** `MINIO_ENDPOINT`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`. 미설정 시 수동 명령 예시 출력.

**주의:** `mc` 클라이언트, `dist/` 존재, 버킷 사전 생성 필요.

---

## 📚 사용 워크플로우

### 로컬 개발 환경

```bash
./scripts/setup-kind-local.sh
./scripts/setup-strimzi-local.sh
./scripts/build-images-local.sh
./scripts/deploy-local.sh
```

### 프로덕션 배포

```bash
./scripts/build-images-prod.sh [REGISTRY] [TAG]
./scripts/setup-oracle-db.sh [NS] [HOST] [SVC] [USER] [PASS]  # 최초 1회
./scripts/deploy-prod.sh [REGISTRY] [TAG]
```

### 문제 해결

```bash
./scripts/debug.sh unbrdn
./scripts/debug.sh unbrdn --resources
./scripts/debug-kafka-local.sh   # Kafka Pool 미기동 시
./scripts/cleanup.sh
./scripts/cleanup.sh --all
```

### Proto 업데이트

```bash
./scripts/compile-proto.sh
./scripts/compile-proto.sh --typescript
./scripts/buf-generate.sh
./scripts/buf-push.sh   # Schema Registry 푸시
```

---

## ⚠️ 공통 주의사항

1. **환경 변수:** 프로덕션 스크립트 실행 전 `.env` 확인.
2. **권한:** Kubernetes 클러스터 접근 권한 필요.
3. **의존성:** 각 스크립트 사전 요구사항(Docker, kubectl, Buf 등) 확인.
4. **백업:** 프로덕션에서 정리 스크립트 실행 전 백업 권장.
5. **네트워크:** 레지스트리·외부 서비스 접근 가능 여부 확인.
