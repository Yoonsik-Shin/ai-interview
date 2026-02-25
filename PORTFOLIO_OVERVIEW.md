# 🚀 AI Interview Solution: Project Portfolio Overview

## 1. 프로젝트 개요 (Introduction)

> **"사용자와 AI 면접관이 실시간으로 대화하며, 이력서를 분석하여 맞춤형 질문을 던지는 차세대 면접 솔루션"**

본 프로젝트는 단순한 텍스트 기반 챗봇을 넘어, **실시간 음성 대화(Speech-to-Speech)**, **이력서 기반 심층 질문 생성(RAG)**, **초저지연 스트리밍 아키텍처**를 구현한 엔터프라이즈급 AI 면접 플랫폼입니다.  
NestJS, Spring Boot, Python(FastAPI)을 활용한 마이크로서비스 아키텍처(MSA)를 기반으로 하며, Kafka와 Redis를 활용한 이벤트 드리븐 설계를 통해 확장성과 안정성을 확보했습니다.

---

## 2. 핵심 기능 (Key Features)

### 🎙️ 1. Real-time Voice Interaction (Speech-to-Speech)

- **Zero-Latency Experience**: 사용자의 발화가 끝나는 즉시 STT(Speech-to-Text)로 변환되고, LLM이 응답을 스트리밍하며, TTS(Text-to-Speech)가 오디오를 재생하는 **End-to-End 스트리밍 파이프라인** 구축.
- **Hybrid Dual-Write Pattern**:
  - **Fast Path (실시간성)**: Socket → gRPC Stream → STT → Redis Pub/Sub (즉시 처리)
  - **Safe Path (데이터 보존)**: Socket → Redis Queue → Storage Worker → Object Storage (비동기 영구 저장)

### 📄 2. Resume-based Adaptive Interview (RAG)

- **VLM (Vision Language Model)**: 이력서(PDF/Image)를 GPT-4o Vision API로 분석하여 텍스트 및 레이아웃 구조 추출.
- **Hybrid Vector Search (Runtime Dialect Detection)**:
  - **Dynamic Query Generation**: `ResumePersistenceAdapter`가 런타임에 DB 타입(PostgreSQL vs Oracle)을 감지하여 적절한 SQL(pgvector `<=>` vs Oracle `VECTOR_DISTANCE`)을 동적으로 생성.
- **Privacy-First**: 클라이언트(Browser) 단에서 `Transformers.js`(WASM) 및 정규식을 활용해 민감정보(PII)를 사전 마스킹하여 서버 전송 최소화.

### 🛠️ 3. Developer Experience (DevTools)

- **Stage Skipper**: `DevToolController`와 `DevToolGuard`를 통해 개발 환경에서만 복잡한 면접 단계를 강제로 건너뛰거나 특정 상태로 진입할 수 있는 백도어 API 제공.

---

## 3. 기술 스택 (Tech Stack) & 아키텍처

### 🏗️ Microservices Architecture

| Service      | Tech Stack             | Role                                                     | Protocol        |
| :----------- | :--------------------- | :------------------------------------------------------- | :-------------- |
| **BFF**      | Node.js, NestJS        | 클라이언트 진입점, 인증(JWT), Centralized gRPC Config    | REST            |
| **Core**     | Java 21, Spring Boot 4 | 도메인 로직, 면접 상태 관리, Adapter-level Transaction   | gRPC, Kafka     |
| **Socket**   | Node.js, NestJS        | 실시간 양방향 통신(Socket.io), Dual-Write Implementation | WebSocket, gRPC |
| **LLM**      | Python, FastAPI        | LangGraph 기반 면접 진행, Sentence Boundary Detection    | gRPC Streaming  |
| **STT**      | Python                 | Whisper/VAD 기반 실시간 음성 인식                        | gRPC Streaming  |
| **TTS**      | Python                 | Edge-TTS 기반 음성 합성                                  | Redis Queue     |
| **Document** | Python                 | 이력서 분석 및 임베딩 생성 (VLM)                         | Kafka           |

### 💾 Infrastructure & DevOps

- **Cloud**: Oracle Cloud Infrastructure (OCI)
- **Event Bus**: Apache Kafka (비동기 처리), Redis Streams (실시간 데이터 파이프라인)
- **Cache & State**: Redis (Pub/Sub, Sentinel High Availability)
- **Database**: Oracle Database (Main), PostgreSQL (Vector/Dev)

---

## 4. 치열한 고민과 의사결정 (Design Decisions & Trade-offs)

### 🏗️ Architecture & Patterns

1. **LLM Context "Push" vs "Pull"**
   - **고민**: LLM이 필요한 데이터(History, Resume)를 스스로 조회(Pull)할지, Core가 모아서 줄지(Push) 결정.
   - **결정**: **Push 방식 (Core Orchestration)**
   - **이유**: 순환 참조(Core↔LLM) 방지 및 단일 gRPC 호출로 Latency 최소화.

2. **UseCase vs Service Distinction**
   - **결정**: Application Layer(**Interactor**)는 비즈니스 흐름 제어, Infrastructure Layer(**Adapter**)는 기술 구현 및 트랜잭션 관리 담당.
   - **구현**: `@Transactional` 어노테이션을 Interactor가 아닌 **Persistence Adapter**에 적용하여 기술적 종속성을 완전히 격리.

### ⚡ Data Pipeline & AI Logic

3. **Smart Buffering & Sentence Detection**
   - **고민**: LLM의 스트리밍 토큰을 TTS로 보낼 때 끊김 없는 경험 제공 필요.
   - **구현**: **LLM Service**가 문장 부호(., ?, !)를 감지하여 `isSentenceEnd` 플래그를 전송하고, **Core Service**의 `TokenAccumulator`가 이를 버퍼링했다가 TTS 큐로 즉시 전송.

4. **Reviewing the "Grace Period" in LangGraph**
   - **고민**: 면접관 소개나 질문 도중에 시간이 다 되면 말이 끊기는 문제.
   - **해결**: LangGraph의 `time_check` 노드에서 `INTERVIEWER_INTRO`, `SELF_INTRO` 등 중요 단계에서는 시간이 초과되어도 강제로 종료하지 않도록 **Grace Period** 로직 구현.

5. **Smart Router & Follow-up Logic**
   - **구현**: LangGraph의 `Router` 노드가 **(1) 꼬리물기 질문(Follow-up) 시 동일 면접관 유지**, **(2) 새로운 질문 시 다른 면접관 랜덤 배정(Repetition Bias)** 로직을 통해 실제 면접 같은 자연스러움 구현.

### 🔌 Interface & Infrastructure

6. **Client-side AI & PII Masking (Privacy-First)**
   - **구현**: `pdfjs-dist`로 텍스트 추출 → **정규식(Regex)**으로 이메일/전화번호 마스킹 → **`Transformers.js` (WASM)**로 임베딩 생성하여 로컬 중복 검사 수행.

7. **Hybrid Vector Search Architecture**
   - **구현**: `ResumePersistenceAdapter`가 JDBC 메타데이터로 연결된 DB 타입(PostgreSQL/Oracle)을 확인하고, **런타임에 호환되는 네이티브 SQL을 동적으로 생성**하여 실행.

8. **BFF gRPC Centralized Config**
   - **결정**: `grpc.module.ts`와 `GrpcConfigService`를 통해 분산된 마이크로서비스들의 gRPC 연결 설정(Host/Port)을 중앙에서 통합 관리.

9. **Concurrency Control (Local vs Distributed)**
   - **현황**: `ProcessLlmTokenInteractor`에서 `ConcurrentHashMap`과 `synchronized` 블록을 사용하여 단일 인스턴스 내 스레드 안전성 보장.
   - **Trade-off**: 분산 환경에서의 동시성 제어(Distributed Lock)는 현재 미적용 상태이며, 추후 Redis Lock 도입 고려.

---

## 5. 트러블슈팅 및 성능 최적화 (Troubleshooting & Optimization)

### 🚀 Latency Optimization (The "Streaming Pipeline")

- **문제**: LLM이 긴 문장을 생성할 때까지 TTS가 대기하면 침묵 시간(Silence)이 길어짐.
- **해결**:
  - **Distributed Pipelining**: LLM(Sentence Detection) → Core(Buffering) → Redis(Queue) → TTS(Synthesis)로 이어지는 파이프라인 최적화.
  - **First Token Latency**: 문장 단위 처리로 사용자는 전체 답변이 생성되기 전에 첫 문장을 듣기 시작함.

### 🛡️ Fault Tolerance

- **문제**: LLM 서비스 일시 장애 시 면접 중단 위험.
- **해결**:
  - **Adapter-level Resilience**: `sttStorageService` 및 `interviewPersistenceAdapter` 등 각 어댑터 계층에서 예외 처리 및 대체 로직(Safe Path) 구현.

---

## 6. 향후 계획 (Future Roadmap)

- **Agentic Workflow**: LLM이 필요 시 스스로 도구(검색, 코드 실행 등)를 호출하는 에이전트 아키텍처 도입.
- **Distributed Locking**: Core 서비스 다중화 시 `Redisson` 등을 활용한 분산 락 적용.
- **Query Service Separation (CQRS)**: 조회 트래픽 증가 시 MongoDB 기반의 별도 조회 전용 서비스 분리.
