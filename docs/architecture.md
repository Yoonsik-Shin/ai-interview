# AI 기반 HR/채용 솔루션 구축 및 인프라 전환 전략 보고서

## 1. 개요 및 아키텍처 비전

본 프로젝트는 실시간 화상 면접, 대용량 비정형 데이터(음성/영상) 분석, AI 역량 평가를 수행하는 지능형 채용 플랫폼 구축을 목표로 합니다. 기존의 모놀리식 구조를 탈피하여 **이벤트 기반 마이크로서비스 아키텍처(Event-Driven Microservices Architecture, EDMA)**를 채택하며, 기술적 완성도와 초기 비용 효율성을 동시에 달성하기 위해 **OCI Ampere(ARM64) 기반의 PoC**와 **AWS 기반의 프로덕션**이라는 이원화된 전략을 수립했습니다.

### 1.1 핵심 기술 목표

- **실시간성 보장:** Socket.io와 gRPC 양방향 스트리밍을 통한 밀리초(ms) 단위 지연 시간 달성.
- **느슨한 결합:** Kafka를 중추 신경망으로 활용하여 서비스 간 의존성 제거.
- **비용 효율성:** OCI 'Always Free' 티어의 ARM 인스턴스를 활용하여 인프라 비용 "0원" 달성.
- **데이터 무결성:** CQRS 및 Transactional Outbox 패턴을 통한 분산 트랜잭션 일관성 확보.

아래는 본 솔루션의 전체적인 이벤트 기반 마이크로서비스 아키텍처 다이어그램입니다.

!(image_0.png)

### 1.2 현재 개발 현황 및 아키텍처 요약

본 저장소의 코드와 Kubernetes 매니페스트 기준으로, **실제 구현된 상태**는 다음과 같습니다.

- **인프라 & 클라우드 전략 (Foundation & Infrastructure)**

  - **Kubernetes 기반 MSA**: `k8s/` 디렉터리 내 매니페스트를 통해 BFF / Core / Inference / Socket 서비스가 MSA 구조로 동작하도록 설계 및 배포 가능 상태.
  - **하이브리드 클라우드 전략**:
    - **OCI Ampere A1 (PoC)**: ARM64 기반 컴퓨팅 리소스를 활용하기 위한 K8s 매니페스트 및 Docker 빌드 전략 정립 (Free Tier 최적화).
    - **AWS (Production Target)**: Section 6에서 정의한 Graviton 기반 마이그레이션 경로 확보.
  - **DB 전환 전략**:
    - 기존 PostgreSQL에서 **Oracle Autonomous Database**로 마이그레이션하기 위한 스크립트 및 가이드 확보:
      - `scripts/setup-oracle-db.sh`
      - `scripts/migrate-to-oracle.sh`
    - `docs/oracle-db-setup.md`, `docs/oracle-troubleshooting.md`를 통해 운영 가이드 정리.
  - **이벤트 버스(Event Backbone)**:
    - **Kafka (Strimzi)**: `k8s/infra/kafka` 하위 매니페스트를 통해 클러스터 내 이벤트 버스 구성 가능.
    - Socket 서비스의 `audio_chunk` 이벤트가 `interview.audio.input` 토픽으로 발행되도록 구현 완료.
  - **데이터 저장소**:
    - **Redis**: 세션/토큰 관리 및 실시간 데이터 캐싱을 위한 인프라 구성 (`k8s/infra/redis`) 및 BFF Auth 모듈에서 Refresh Token 저장소로 사용.
    - **PostgreSQL / Oracle**: 사용자, 이력서 등 핵심 도메인 데이터를 위한 관계형 저장소 준비 완료 (Self-hosted PostgreSQL → Oracle Autonomous DB로 전환 스크립트/가이드 제공).

- **마이크로서비스 구성 (Service 구현 현황)**

  - **Core Service (Java / Spring Boot)** — 도메인 비즈니스 로직의 중심

    - **도메인 모델링**: `Users`, `Resumes`, `Interviews`, `InterviewHistory`, `InterviewQnA`, `InterviewReports`, `UserSkills` 등 핵심 엔티티 및 리포지토리 구현.
    - **Auth 모듈 (Hexagonal)**:
      - `Users` 엔티티에 `password` 필드 및 정적 팩토리/변경 메서드(`createWithPassword`, `changePassword`, `getEncodedPassword`) 구현.
      - `RegisterUserUseCase`, `AuthenticateUserUseCase` 등 Application Port 및 Interactor 구현.
      - `AuthGrpcController`를 통해 `signup`, `validateUser` gRPC 엔드포인트 제공.
    - **Resume 모듈 (Hexagonal)**:
      - `Resumes` 엔티티 및 `ResumesRepository` 구현, LOB 컬럼을 사용해 추출 텍스트 저장.
      - `UploadResumeUseCase` 및 `UploadResumeInteractor`에서
        - 사용자 조회 (`LoadUserPort` → `UsersRepository`)
        - `DocumentParser`(Apache Tika 기반)로 PDF/Word 등에서 텍스트 추출
        - 추출 텍스트를 포함한 `Resumes` 엔티티 생성 및 저장 (`SaveResumePort` → `ResumesRepository`)
      - `ResumeGrpcController`를 통해 `uploadResume` gRPC 엔드포인트 제공.
    - **Interview 모듈**:
      - `Interviews` 및 관련 엔티티/리포지토리 구현.
      - `InterviewService` + `GrpcInterviewService`를 통해 면접 생성 gRPC API 제공.

  - **BFF Service (Node.js / NestJS)** — API Gateway & Aggregator

    - **gRPC 연동**:
      - `INTERVIEW_PACKAGE`, `AUTH_PACKAGE`, `RESUME_PACKAGE` 등 gRPC 클라이언트를 `ClientsModule.register`로 등록.
      - Core의 Auth/Interview/Resume gRPC 서비스와 통신하는 인프라스트럭처 어댑터 구현.
    - **Auth 모듈**:
      - `AuthModule`에서 `JwtModule`, `PassportModule`, `RedisModule`, gRPC 클라이언트(`AUTH_PACKAGE`)를 구성.
      - `GrpcCoreAuthClient`를 통해 Core의 `AuthService` gRPC(`signup`, `validateUser`) 호출.
      - `AuthService`:
        - 회원가입 시 Core `signup` → 곧바로 `validateUser` 호출 후 JWT 발급.
        - 로그인 시 `validateUser` 호출 후 Access/Refresh Token 발급.
        - Refresh Token은 Redis(`refresh_token:{userId}` 키)에 TTL 7일로 저장.
      - `JwtStrategy`, `JwtAuthGuard`, `@CurrentUser` 데코레이터 등 인증 인프라 구현.
    - **Resumes 모듈**:
      - `ResumesService`에서 gRPC `ResumeService.uploadResume` 호출 래핑.
      - 컨트롤러를 통해 클라이언트의 파일 업로드를 받아 Core로 프록시.
    - **Interviews 모듈**:
      - `InterviewsService`/`InterviewsController`에서 Core Interview gRPC와 연동하여 면접 세션 생성 등 기본 API 제공.
    - **Redis 모듈**:
      - `RedisModule`, `RedisService`를 통해 공용 Redis 클라이언트 제공 (현재는 주로 Auth 모듈에서 사용).

  - **Socket Service (Node.js / NestJS)** — 실시간 양방향 통신 + Kafka 브리지

    - `EventsGateway`:
      - 클라이언트 연결 시 토큰 존재 여부 확인(실제 JWT 검증은 TODO 상태).
      - `audio_chunk` 이벤트 처리:
        - 바이너리/베이스64 오디오 청크 수신.
        - `interview.audio.input` Kafka 토픽으로 `interviewId`, `userId`, `audioChunk`, `timestamp`를 JSON으로 발행.
      - `send_answer` 이벤트 처리:
        - 사용자의 텍스트 답변을 수신하여 Python Inference HTTP API(`/interview`)로 스트리밍 호출.
        - 수신한 스트림을 `stream_chunk`/`stream_end` 소켓 이벤트로 클라이언트에 전달.
        - 최종 결과를 `interview-result` Kafka 토픽에 발행.
    - `RedisIoAdapter`:
      - Redis 기반 Socket.io 어댑터 구현(멀티 인스턴스 확장을 위한 기반).

  - **Inference Service (Python)** — LLM API 및 STT Consumer 스켈레톤
    - **FastAPI 기반 LLM 서비스 (`main.py`)**:
      - `/interview` 엔드포인트:
        - 요청 바디로 `user_answer`를 받아 OpenAI Chat Completions API를 스트리밍 모드로 호출.
        - “10년 차 IT 개발자 면접관” 시스템 프롬프트를 사용하여 꼬리 질문 한 문장을 생성.
        - `StreamingResponse`로 한 글자씩/청크 단위로 반환.
      - `/ping`, `/stream` 등 헬스체크/테스트 엔드포인트 제공.
      - Socket 서비스에서 텍스트 기반 티키타카 프로토타입으로 이미 실사용 가능 상태.
    - **Kafka STT Consumer 스켈레톤 (`kafka_consumer.py`)**:
      - `interview.audio.input` 토픽을 소비하는 `consume_audio_chunks()` 구현.
      - 오디오 청크 수신 및 로깅까지 구현되어 있으며,
      - Whisper 연동 및 `interview.text.input` 토픽으로의 텍스트 전송 부분은 `TODO` 상태.

- **Revised Plan과의 매핑 (현재 준비 상태 vs 향후 작업)**

Revised Implementation Plan의 4개 Phase와 현재 코드/인프라 준비 상태를 다음과 같이 매핑할 수 있습니다.

| Phase   | 목표 기능                        | 현재 준비 상태 (Ready Check)                                                                                                                                                            | 향후 작업 (Action Item)                                                                                                                                                                                                                   |
| :------ | :------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1 | 인증 / 사용자 관리 (Auth)        | ✅ `Users` 엔티티 + `password` 필드 구현<br>✅ Core Auth UseCase + gRPC(`AuthGrpcController`) 구현<br>✅ BFF Auth 모듈(JWT, Redis, gRPC, Guard/Strategy) 완전 연동                      | - Socket: JWT 토큰 실제 검증 로직(BFF와 동일한 시크릿/전략) 적용<br>- Auth 관련 도메인/예외/로깅/모니터링 정비                                                                                                                            |
| Phase 2 | 이력서 분석 (RAG 기초 데이터)    | ✅ `Resumes` 엔티티 및 저장 스키마(LOB 텍스트) 구현<br>✅ Apache Tika 기반 `DocumentParser` 및 `UploadResumeInteractor`로 텍스트 추출 후 DB 저장<br>✅ gRPC `uploadResume` 및 BFF 연동  | - Resume 업로드 API에 인증/권한 연동(JWT 기반 userId 검증)<br>- 텍스트 전처리/후처리(정규화, 토큰화 등)<br>- 향후 벡터 임베딩을 위한 별도 워커/파이프라인 추가                                                                            |
| Phase 3 | 음성 대화 (Streaming Pipeline)   | ✅ Socket.io 게이트웨이 및 `audio_chunk` 이벤트 구현<br>✅ Kafka 인프라(Strimzi) 및 `interview.audio.input` 토픽 발행 구현<br>✅ Python STT Consumer 스켈레톤(`kafka_consumer.py`) 작성 | - Inference: Whisper STT 연동 및 `interview.text.input` 토픽으로 텍스트 전송 구현<br>- BFF 또는 별도 워커에서 `interview.text.input` 소비 후 LLM 호출/상태 관리와의 연결 구조 설계                                                        |
| Phase 4 | 면접 오케스트레이션 (LLM + 상태) | ✅ Inference LLM HTTP API(`/interview`) 구현 및 Socket과 연동(텍스트 기반 티키타카 프로토타입 동작)<br>✅ Redis 인프라 및 BFF Auth에서의 활용<br>✅ Interview 생성/저장 gRPC 흐름 구현  | - Redis를 면접 세션 상태 저장소로 확장(`interview:session:{id}`)<br>- Kafka 텍스트 토픽(`interview.text.input` / `interview.text.output`) 정식 도입<br>- RAG: Core DB 이력서 텍스트 + 대화 히스토리 기반 프롬프트 구성 및 LLM 호출 일원화 |

### 1.3 Revised Implementation Plan (Feature First) 개요

기존 문서의 Phase 1~4(인프라/AI/애플리케이션 관점)를 유지하면서, 실제 기능 구현은 다음의 **Feature First 관점 Phase 1~4**에 따라 진행합니다.

- **Phase 1 – 인증 및 사용자 관리 (Foundation)**

  - **목표:** "누가 면접을 보는가?"를 식별하기 위한 보안 기반 마련 (Gateway Offloading + JWT + Redis).
  - **현황:** Core Auth 모듈(gRPC 포함)과 BFF Auth 모듈(JWT, Redis, Guard)이 이미 동작 가능한 상태로 구현되어 있으며, Socket의 연결 인증만 남아 있음.
  - **다음 작업:** Socket에서 JWT를 실제로 검증하도록 하고, 인터뷰 관련 API/소켓 이벤트에 Auth Guard를 점진적으로 적용.

- **Phase 2 – 이력서 분석 (RAG Setup)**

  - **목표:** 지원자의 이력서 데이터를 구조화하여 AI가 활용할 수 있는 텍스트 저장소 구축.
  - **현황:** Core Resume 모듈이 Apache Tika 기반 텍스트 추출 + DB 저장까지 구현 완료되었고, BFF에서 파일 업로드를 받아 Core로 전달하는 gRPC 연동도 완료됨.
  - **다음 작업:** 업로드된 이력서 텍스트를 후처리(정규화/전처리)하고, 향후 벡터 임베딩/RAG를 위한 별도 워커 또는 Python Inference와의 연동 지점을 정의.

- **Phase 3 – 실시간 음성 파이프라인 (Streaming)**

  - **목표:** 텍스트 채팅을 넘어, 실시간 음성 기반 대화가 가능하도록 데이터 파이프라인 구축.
  - **현황:** Socket 서비스가 `audio_chunk` 이벤트를 통해 오디오 청크를 수신하고 `interview.audio.input` Kafka 토픽으로 발행하는 부분까지 구현되어 있으며, Python 쪽에 해당 토픽을 소비하는 STT Consumer 스켈레톤이 존재.
  - **다음 작업:** Whisper STT 연동 및 `interview.text.input` 토픽으로 텍스트를 발행하는 로직 구현, 이후 이 텍스트를 LLM/세션 상태 관리와 연결하는 BFF 또는 Inference 측 파이프라인 설계.

  - **세부 구현 플랜 (Phase 3)**
    - **Socket Service**
      - `audio_chunk` 페이로드 스키마 고정: `{ interviewId, userId, chunk, sequence, isLast }`.
      - JWT 토큰에서 `userId` 추출 후 `client` 객체에 저장하여, Kafka 메시지 키를 `interviewId:userId`로 일관되게 유지.
      - 네트워크 환경에 따라 WebRTC 또는 순수 WebSocket + 바이너리 전송 방식을 선택할 수 있도록 클라이언트 프로토콜 정의.
    - **Kafka 레이어**
      - 입력 토픽: `interview.audio.input` (key: `interviewId:userId`, value: JSON with base64 audio).
      - STT 결과 토픽: `interview.text.input` (key: `interviewId:userId`, value: `{ text, isFinal, timestamp }`).
    - **Inference Service (Python) – STT 워커**
      - `kafka_consumer.py`에서 Whisper 또는 Faster-Whisper를 이용해
        - 오디오 청크를 세션 단위로 버퍼링.
        - `isLast` 수신 시 한 발화를 STT로 변환.
      - 변환된 텍스트를 `interview.text.input` 토픽으로 발행하여, 이후 LLM/RAG에서 공통으로 사용.

- **Phase 4 – 면접 오케스트레이션 및 LLM 연동 (Orchestration)**

  - **목표:** 단발성 질의응답이 아닌, 면접 세션 단위의 상태 관리와 LLM 기반 대화 흐름 제어.
  - **현황:** Inference 서비스의 `/interview` HTTP API와 Socket의 `send_answer` 이벤트를 통해 텍스트 기반 티키타카 면접 프로토타입이 동작 중이며, Core Interview gRPC 및 Redis 인프라도 존재하지만 세션 상태 관리와 RAG는 아직 미적용.
  - **다음 작업:** Redis를 면접 세션 상태 저장소로 확장하고, Kafka 텍스트 토픽과 Core 이력서 텍스트를 묶어 RAG 프롬프트를 생성한 뒤, LLM 응답을 다시 Kafka/Socket을 통해 사용자에게 전달하는 전체 오케스트레이션을 완성.

  - **세부 구현 플랜 (Phase 4)**
    - **세션 상태 관리 (BFF + Redis)**
      - 세션 키: `interview:session:{interviewId}` 구조로 저장.
      - 값에는 `userId`, 현재 단계(`step`), 최근 N개의 대화 히스토리(`history`), 인터뷰 페르소나/직무 정보 등을 JSON으로 저장.
      - 면접 시작/종료 REST API를 통해 세션 생성/정리, Socket 연결 시 해당 세션과 바인딩.
    - **RAG + LLM (Inference)**
      - `interview.text.input` 토픽의 메시지를 소비하여, 각 발화에 대해:
        - Core 서비스에서 gRPC/REST로 이력서 텍스트(또는 요약)를 조회.
        - Redis에서 세션 히스토리/단계 정보를 조회.
        - 이력서 + 히스토리 + 현재 발화를 합쳐 RAG 프롬프트 템플릿을 구성.
        - OpenAI API(GPT-4o-mini 등)를 호출하여 면접관 응답을 생성.
      - 결과를 `interview.text.output` 토픽으로 발행.
    - **응답 전달 (BFF/Socket)**
      - BFF 또는 Socket 서비스에서 `interview.text.output` 토픽을 소비.
      - `interviewId:userId` 키를 기준으로 적절한 Socket 클라이언트에 매핑하여 `ai_message` 이벤트로 전송.
      - Redis 세션의 `history`에 사용자 발화/AI 응답을 순차적으로 추가하여, 이후 RAG 컨텍스트로 재사용.

---

### 1.4 Kubernetes 실행 전략: 로컬(Local) vs 프로덕션(Prod)

본 프로젝트는 동일한 마이크로서비스 구성을 유지하면서, **로컬 개발용 K8s 클러스터**와 **OCI 프로덕션 K8s 클러스터**에서 다음과 같은 차이점을 갖습니다.

- **공통 사항**

  - 네임스페이스: 애플리케이션 및 인프라 리소스 대부분은 `unbrdn` 네임스페이스에 배포.
  - 서비스 구조: BFF / Core / Socket / Inference + Redis / Kafka / (PostgreSQL or Oracle) 구성은 동일.
  - Ingress: `main-ingress` 리소스를 통해 HTTP(API) + WebSocket(Socket.io) 트래픽을 라우팅.

- **로컬 K8s 환경 (예: Docker Desktop, kind, minikube)**

  - **이미지/레지스트리**
    - `deployment-local.yaml` 계열에서 애플리케이션 이미지는 주로 `bff:latest` 와 같이 **로컬 빌드 이미지**를 사용.
    - 이미지 풀 정책: `IfNotPresent` 로 설정하여, 로컬에서 빌드한 이미지를 재사용.
  - **환경변수/구성**
    - `bff` 예시:
      - `REDIS_HOST=redis`, `KAFKA_BROKER=kafka:29092`, `PYTHON_WORKER_URL=http://inference:8000`, `CORE_GRPC_HOST=core` 등 단순한 클러스터 내부 서비스 이름 사용.
      - `JWT_SECRET` 는 개발용 고정 값(`your-secret-key-change-in-production`)으로 설정.
    - Redis/Kafka도 `*-deployment-local.yaml`에서 최소 리소스 요청으로 단일 인스턴스 구성.
  - **Ingress**
    - `ingress-local.yaml`:
      - `host: localhost`.
      - `/api` → `bff`, `/socket.io` → `socket`, `/admin` → `kafka-ui`, `/` → `bff` 라우팅.
      - TLS 없이 HTTP로 동작, CORS 허용(`cors-allow-origin: *`) 등 개발 편의 위주 설정.
  - **목표**
    - 단일 노드/경량 환경에서 전체 파이프라인(BFF-Core-Socket-Inference-Kafka-Redis)을 손쉽게 올리고 디버깅.

- **프로덕션 K8s 환경 (OCI OKE)**

  - **이미지/레지스트리**
    - `deployment-prod.yaml` 계열에서 이미지는 `${IMAGE_REGISTRY}/unbrdn-krn-ocir-bff:${IMAGE_TAG}` 와 같이 **OCI Container Registry(OCIR)** 기반.
    - `imagePullSecrets: ocir-secret` 를 통해 Private Registry 인증.
  - **환경변수/구성**
    - 환경 변수들은 `bff-config` 등 ConfigMap/Secret을 통해 주입:
      - `REDIS_HOST`, `REDIS_PORT`, `KAFKA_BROKER`, `PYTHON_WORKER_URL`, `CORE_GRPC_HOST`, `CORE_GRPC_PORT` 등.
    - Redis/Kafka는 각각 `redis-deployment-prod.yaml`, `strimzi-kafka-prod.yaml` 을 통해
      - 더 높은 리소스 요청/제한.
      - Strimzi Operator 기반 멀티 브로커 구성을 목표로 하는 설정 사용.
  - **Ingress**
    - `ingress-prod.yaml`:
      - `host: unbrdn.me` 와 TLS(`tls-secret`)를 사용하여 HTTPS 종단.
      - `cert-manager.io/cluster-issuer: letsencrypt-prod` 로 자동 인증서 발급.
      - `nginx.ingress.kubernetes.io/affinity: "cookie"` 로 Sticky Session 설정, WebSocket 안정성 강화.
      - 주석/설정으로 OCI Load Balancer 타입 지정.
  - **목표**
    - OCI Ampere A1 기반 OKE 클러스터에서, 보안(HTTPS/TLS), 확장성(Strimzi Kafka), 운영 편의(ConfigMap/Secret 기반 설정)을 고려한 프로덕션 수준 배포.

요약하면, **로컬 K8s는 개발/디버깅을 위한 단일 노드·로컬 이미지 중심 구성**, **프로덕션 K8s는 OCIR 이미지 + Strimzi Kafka + HTTPS Ingress 기반의 운영 구성**으로, 동일한 마이크로서비스 아키텍처를 서로 다른 환경에서 일관되게 실행할 수 있도록 설계되어 있습니다.

---

## 2. Phase 1: OCI 프리티어 기반 Zero-Cost 인프라 구축 (PoC)

초기 스타트업 및 연구 개발 단계에서의 비용 절감을 위해 OCI의 고성능 ARM 인스턴스를 활용합니다. 이는 AWS 무료 티어의 한계(메모리 부족)를 극복할 수 있는 유일한 대안입니다.

### 2.1 컴퓨팅 아키텍처: OKE와 Ampere A1

OCI는 4 OCPU(물리 코어 4개)와 24GB RAM을 무료로 제공합니다. 이는 JVM 기반의 Kafka와 메모리 집약적인 AI 모델을 동시에 구동하기에 충분한 리소스입니다.

- **오케스트레이션:** OCI OKE (Oracle Kubernetes Engine) Basic Cluster (Control Plane 무료).
- **노드 구성 전략:** 가용성과 리소스 효율성을 고려한 **2노드 분산 구성**.
  - **Node Shape:** `VM.Standard.A1.Flex` (ARM64)
  - **Spec:** 2 Nodes × (2 OCPUs, 12GB RAM).
  - **OS:** Oracle Linux Cloud Developer (AArch64).

### 2.2 스토리지 및 네트워크 최적화

OCI 프리티어의 제약 사항(스토리지 200GB, 로드밸런서 대역폭 10Mbps)을 극복하기 위한 기술적 우회 전략입니다.

- **스토리지 전략 (Tiered Storage):**
  - **부트 볼륨:** 노드당 50GB 할당 (총 100GB 소모).
  - **데이터 볼륨:** 잔여 100GB를 PVC로 할당하여 Kafka 및 DB에 사용.
  - **계층화(Tiering):** Kafka의 오래된 로그는 OCI Object Storage(무료 10GB)로 오프로딩하여 로컬 디스크 사용량 최소화.
- **네트워크 전략:**
  - **로드 밸런서:** OCI Flexible LB를 사용하되, 텍스트 트래픽(API, Socket)만 통과시킴.
  - **영상 트래픽(WebRTC):** P2P 통신을 원칙으로 하며, 서버 경유가 필요한 경우 대역폭 제한이 없는 인스턴스 직접 통신(NodePort/HostNetwork) 또는 유료 LB 증설 고려.
  - **아웃바운드:** 월 10TB 무료 트래픽을 활용하여 영상 데이터 전송 비용 절감.

---

## 3. Phase 2: 핵심 백엔드 및 이벤트 버스 구현

시스템의 중추인 메시징 큐와 데이터베이스를 ARM 아키텍처 호환성을 고려하여 구축합니다.

### 3.1 메시징 백본 (Kafka on Strimzi)

- **구축:** Strimzi Kafka Operator를 사용하여 Kubernetes 네이티브하게 구축. Strimzi는 ARM64를 공식 지원함.
- **구성:** Kafka Broker 3개, Zookeeper(또는 KRaft) 3개 구성.
- **메모리 튜닝:** Broker Heap 4GB, Zookeeper Heap 1GB 할당 (총 24GB 메모리 활용).

### 3.2 데이터베이스 (Managed Database)

**Oracle Autonomous Database (Always Free Tier)** 사용:

- **비용**: $0/월 (Always Free Tier)
- **구성**: 2 OCPU, 1TB 스토리지
- **장점**:
  - 리소스 절감 (200m CPU, 256Mi 메모리 확보)
  - 자동 백업 및 패치 관리
  - 고가용성 기본 제공
  - Zero-Cost 유지

**도입 이유:**

- Self-hosted PostgreSQL Pod 제거로 리소스 확보
- Core Pod 2개 실행 가능 (고가용성)
- 관리 부담 감소

자세한 설정 방법은 [oracle-db-setup.md](./oracle-db-setup.md)를 참조하세요.

아래 그림은 CQRS 패턴과 Transactional Outbox 패턴을 통한 데이터 흐름을 상세히 보여줍니다.

!(image_1.png)

---

## 4. Phase 3: CPU 기반 AI 서비스 최적화 (GPU-less)

OCI 프리티어에는 GPU가 제공되지 않으므로, CPU(Ampere A1)만으로 실시간 AI 추론을 수행할 수 있도록 경량화 및 최적화를 수행합니다.

### 4.1 AI 면접관 (LLM)

- **모델:** Llama 3 8B (Quantized).
- **최적화:** 4-bit 양자화(Q4_K_M)를 적용하여 모델 크기를 약 5.7GB로 축소.
- **성능:** OCI A1 4 OCPU 기준 초당 약 **30 토큰(TPS)** 생성 가능. 이는 실시간 대화에 충분한 속도임.

### 4.2 음성 및 영상 분석

- **STT (음성 인식):** Whisper.cpp 또는 Faster-Whisper(CTranslate2 기반)를 사용하여 Python 런타임 오버헤드 없이 고속 추론.
- **영상 분석:** 무거운 CNN 대신 **MediaPipe**를 활용하여 CPU만으로 얼굴 랜드마크 및 감정 분석 수행 (ARM NEON 가속 활용).
- **비동기 처리:** 실시간성이 덜 중요한 심층 분석은 Kafka 컨슈머를 통해 백그라운드에서 비동기로 처리.

---

## 5. Phase 4: 애플리케이션 개발 및 CI/CD

### 5.1 실시간 통신 (Socket.io & gRPC)

- **Socket Server:** Node.js 기반. Redis Adapter를 도입하여 다중 파드 간 메시지 브로드캐스팅 구현.
- **gRPC Streaming:** 오디오 데이터의 실시간 전송을 위해 HTTP/2 기반의 양방향 스트리밍 적용. Nginx Ingress Controller에서 gRPC 라우팅 처리.
- **Sticky Session:** `nginx.ingress.kubernetes.io/affinity: "cookie"` 설정을 통해 웹소켓 연결 안정성 확보.

### 5.2 멀티 아키텍처 빌드 (Docker Buildx)

개발 환경(x86)과 운영 환경(ARM64)의 아키텍처가 다르므로, Docker Buildx를 이용한 크로스 플랫폼 빌드가 필수적입니다.

```bash
# Docker Buildx를 사용한 ARM64 이미지 빌드 예시
docker buildx build --platform linux/arm64 -t my-registry/core-service:latest --push
```

---

## 6. AWS 프로덕션 전환 로드맵 (Future Step)

PoC 검증 완료 후 대규모 트래픽 처리가 필요한 시점에는 AWS 정석 아키텍처로 전환합니다. 이 과정에서 OCI PoC 구축 경험(ARM 호환성 등)은 그대로 재활용됩니다.

### 6.1 인프라 마이그레이션 (Terraform)

- **Compute:** AWS Graviton 3/4 (ARM64) 인스턴스 도입. OCI에서 사용한 Docker 이미지를 그대로 사용하며 비용 효율성 극대화.
- **Managed Services:**
  - Self-hosted Kafka -> **Amazon MSK**
  - Containerized DB -> **Amazon RDS / DocumentDB**
  - OCI OKE -> **AWS EKS**.

### 6.2 고성능 AI 추론 (GPU 도입)

- **인스턴스:** `g4dn.xlarge` (T4 GPU) 도입.
- **비용 절감:** AI 워크로드는 상태가 없으므로(Stateless), **Spot Instances**와 Karpenter를 활용하여 GPU 비용을 최대 70% 절감.

### 6.3 비용 및 성능 비교

| 항목         | OCI 프리티어 (PoC) | AWS 프로덕션 (Target) | 비고                     |
| :----------- | :----------------- | :-------------------- | :----------------------- |
| **비용**     | **$0 (Zero Cost)** | **$1,200+ / 월**      | 초기 비용 절감 효과 탁월 |
| **CPU**      | Ampere A1 (ARM)    | Graviton (ARM)        | 아키텍처 호환성 유지     |
| **AI 추론**  | CPU (양자화 모델)  | GPU (Full Precision)  | 서비스 품질 향상 시 전환 |
| **네트워크** | 10TB 무료          | GB당 과금             | 트래픽 최적화 필요       |

---

## 7. 인프라 설계 결정사항

### 7.1 Kubernetes 네임스페이스 설계

프로젝트는 **단일 네임스페이스(`unbrdn`) 패턴**을 사용합니다:

- **모든 리소스**: 인프라(Redis, Kafka)와 애플리케이션(BFF, Core, Inference, Socket) 모두 `unbrdn` 네임스페이스
- **Operator**: Strimzi Operator만 `kafka` 네임스페이스에 별도 설치 (클러스터 전체 watch)

**선택 이유:**

- 소규모 프로젝트에 적합
- 서비스 디스커버리 단순화 (같은 네임스페이스)
- 관리 단순성
- 단일 팀 운영

**대안 패턴:**

- 대규모 프로젝트: 인프라/애플리케이션 네임스페이스 분리
- 멀티 테넌트: Strimzi Operator 클러스터 전체 watch

### 7.2 데이터베이스 전환 결정

**PostgreSQL → Oracle Autonomous Database 전환**

**전환 전:**

- Self-hosted PostgreSQL Pod (200m CPU, 256Mi 메모리)
- Core Pod 2개 실행 불가 (리소스 부족)
- 수동 백업 및 패치 관리

**전환 후:**

- Oracle Autonomous Database Always Free Tier ($0/월)
- 리소스 확보: 200m CPU, 256Mi 메모리
- Core Pod 2개 실행 가능 (고가용성)
- 자동 백업 및 패치 관리

**비용 비교:**

- PostgreSQL (Self-hosted): $0/월 (하지만 클러스터 리소스 사용)
- Oracle DB (Always Free): $0/월 (클러스터 리소스 사용 없음)
- **효과**: Zero-Cost 유지 + 리소스 확보 + 관리 부담 감소

---

## 8. 결론

본 계획서는 **"기술적 부채 없는 비용 절감"**을 핵심 전략으로 제시합니다. OCI Ampere A1 기반의 PoC 구축은 단순한 무료 사용을 넘어, **Kubernetes, Kafka, ARM 아키텍처**라는 최신 기술 트렌드를 내재화하는 과정입니다.

1.  **즉시 실행:** OCI 계정 생성 및 OKE 클러스터 구축 (2노드 전략).
2.  **핵심 검증:** Docker Buildx 파이프라인 구성 및 Llama 3 CPU 추론 테스트.
3.  **확장 준비:** Terraform을 통한 인프라 코드화(IaC)로 향후 AWS 전환 대비.

이 전략을 통해 귀사는 초기 자본 지출 없이 엔터프라이즈급 AI 채용 솔루션의 기술적 타당성을 완벽하게 검증할 수 있습니다.
