## 이력서 임베딩 & Vector 검색 아키텍처 정리

### 1. 기본 전제

- **운영 RDB**: Oracle (유저, 이력서 메타데이터, 인터뷰 세션 등 도메인 데이터 저장)
- **파일 저장소**: Object Storage (로컬: MinIO, 운영: OCI Object Storage)
- **Vector 검색**: Oracle이 제공하는 **AI Search / Vector 기능**을 VectorDB로 사용
- **메시징**: Kafka 를 통한 이벤트 기반 마이크로서비스 연동

---

### 2. 이력서 업로드 경로

- **로컬 환경**
  - Frontend → **BFF** HTTP 업로드 → Storage 서비스 → MinIO 에 저장
  - 개발 편의를 위해 BFF가 파일을 중계해도 무방

- **운영 환경**
  - Frontend → **BFF에 업로드 요청**
  - BFF:
    - 인증/권한 체크
    - Oracle RDB 에 이력서 메타데이터(작성자, 파일명 등) 사전 등록
    - Object Storage용 **Presigned URL 발급**
  - Frontend:
    - Presigned URL 로 **클라이언트 → Object Storage 직접 업로드**

이 구조는 BFF를 병목점에서 분리하고, 대용량 파일 트래픽을 Object Storage로 바로 흘려보낼 수 있어 확장성이 좋다.

- **참고: MinIO Presigned URL**
  - MinIO는 S3 호환 Presigned URL을 지원하므로,
  - 로컬 환경에서도 BFF가 MinIO SDK를 이용해 Presigned URL을 발급한 뒤,  
    클라이언트가 해당 URL로 직접 업로드하는 패턴을 운영 환경과 동일하게 적용할 수 있다.

---

### 3. 임베딩 & Vector 저장 흐름

1. **이력서 업로드/수정 이벤트**
   - 업로드/수정 완료 시 Core/Resume 도메인에서 다음을 수행:
     - Oracle `resumes` 테이블에 메타데이터/파싱 상태 저장
     - Kafka 토픽(`resume_uploaded` 또는 `resume_updated`)에 이벤트 발행

2. **Embedding 서비스**
   - 별도 마이크로서비스(예: `resume-embedding-service`) 또는 LLM/Inference 서비스 확장으로 구현
   - 역할:
     - 이벤트 수신 (`resume_uploaded`)
     - Object Storage / MinIO 에서 원본 파일 다운로드
     - 텍스트/이미지 파싱
     - 임베딩 생성 (OpenAI, 자체 모델, Oracle AI 기능 등)
     - **Oracle AI Search(Vector 컬렉션)에 `resume_id` 기준으로 upsert**

3. **검색/RAG 사용**
   - 면접 질문 생성, 추천 질문, 이력서 기반 질의응답 시:
     - `resume_id` 또는 사용자 ID로 Oracle AI Search에 **벡터+키워드 쿼리**
     - 상위 k개 문단/이미지 설명을 받아 LLM 프롬프트에 주입 (RAG)

---

### 4. VectorDB 설계 선택지와 현재 방향

- 가능한 Vector 저장 방식:
  - **Postgres + pgvector**: 별도 Vector 전용 DB 서버 (다른 프로젝트에서 흔히 사용)
  - **Qdrant / Chroma**:
    - Qdrant: Vector 전용 DB 서버 (HTTP/gRPC)
    - Chroma: 로컬 개발/연구용 임베디드 Vector 라이브러리/서버
  - **Oracle AI Search / Vector 기능**: Oracle 생태계 안에서 Vector 검색까지 통합

- 이 프로젝트의 의도된 방향:
  - **운영 RDB = Oracle**
  - **VectorDB = Oracle AI Search/Vector 기능**
  - 로컬/PoC 용으로는 필요 시 pgvector 또는 Chroma 같은 경량 VectorDB를 사용하되,
    애플리케이션 레벨에서는 `EmbeddingSearchPort` 같은 추상화 포트를 두어 구현체를 교체 가능하게 설계

---

### 5. 사전 임베딩 vs On-demand 임베딩

#### 5.1 사전 임베딩(Pre-compute) 방식 – 추천

- **방식**
  - 이력서 업로드/수정 시점에:
    - 텍스트/이미지 파싱 → 임베딩 생성 → Oracle AI Search에 upsert
  - 검색 시에는 **VectorDB에서 유사도 검색만 수행**

- **장점**
  - 검색 시 지연시간이 매우 짧음 (DB 조회만 수행)
  - 동일 이력서를 여러 번 조회해도 임베딩 비용이 한 번만 발생
  - 읽기 트래픽이 커질수록 VectorDB 스케일링으로 대응하기 쉬움

- **단점/주의**
  - 이력서가 자주 갱신되는 경우 **재임베딩 파이프라인** 필요
    - `resume_updated` 이벤트 → Embedding 서비스에서 재임베딩 → 기존 Vector 레코드 upsert

#### 5.2 On-demand 임베딩 방식 – 실험/소규모 용도

- **방식**
  - Oracle RDB에 이력서 원문만 저장
  - 검색 요청이 들어올 때마다:
    - 이력서 텍스트 로드 → 그때그때 임베딩 생성 → 메모리/임시 VectorDB 에서 검색

- **장점**
  - 초기 구현이 단순 (별도 Vector 인프라 없이도 PoC 가능)
  - 거의 조회되지 않는 데이터라면 불필요한 사전 임베딩을 피할 수 있음

- **단점**
  - 요청마다 Embedding API/모델 호출이 들어가 **지연시간↑, 비용↑**
  - 트래픽이 늘어나면 사실상 캐싱/사전 임베딩으로 다시 설계해야 함

#### 5.3 추천 전략 (이 프로젝트 기준)

- **정식 서비스**:
  - 기본 전략을 **“사전 임베딩 + Oracle AI Search에 저장”** 으로 두는 것을 권장
  - 이력서 업로드/수정 이벤트가 임베딩 파이프라인의 트리거

- **개발/실험 단계**:
  - 작은 데이터셋, PoC 단계에서는
    - RDB에서 꺼내 on-demand 임베딩 + 간단한 코사인 유사도 계산으로 실험 가능
  - 구조를 `EmbeddingSearchPort` 인터페이스 뒤에 숨겨두면
    - 나중에 Oracle AI Search, Qdrant, pgvector 등으로 쉽게 교체 가능

---

### 6. 요약

- **배포 환경**
  - 운영 RDB: Oracle
  - Vector 검색: Oracle AI Search/Vector 기능
  - 파일 업로드: Presigned URL 기반 Object Storage 직접 업로드
  - 이벤트 기반: Kafka `resume_uploaded` / `resume_updated` 를 통해 Embedding 서비스와 연동

- **아키텍처 적합성**
  - 현재 이벤트 기반 마이크로서비스( Core, Storage, LLM, STT, TTS, Socket ) 구조는
    - 이력서 임베딩 + Vector 검색 파이프라인을 **자연스럽게 추가할 수 있는 구조**이며,
    - 별도 VectorDB(Qdrant 등)로 교체해도 무리 없이 확장 가능하다.

---

### 7. 추가 고려사항 (메시징, 인프라, 비용)

#### 7.1 Redis Streams vs Kafka 역할 분리

- **Redis Streams**
  - 세션 상태, 단일 서비스 내부의 빠른 큐/스트림 용도로 적합
  - 로컬 실험·저지연 내부 파이프에 사용하기 좋음
- **Kafka**
  - 여러 마이크로서비스가 같은 이벤트를 독립적으로 구독해야 하는 **중심 이벤트 버스** 역할에 적합
  - `resume_uploaded` 이벤트를 Embedding 서비스, 추천 서비스, 로깅/모니터링 등이 동시에 소비하는 구조에 유리
- 이 프로젝트에서는:
  - **Kafka를 이력서/인터뷰 관련 도메인 이벤트의 메인 버스로 두고**,  
  - Redis Streams는 필요한 경우 Core/Socket 등의 **핫 패스(세션 캐시·스트리밍 보조)** 에 한정하는 구성이 자연스럽다.

#### 7.2 Embedding 서비스 배포 패턴

- **옵션 A – K8s Pod로 Embedding 서비스 운영**
  - 장점: 완전한 마이크로서비스 분리, HPA로 자동 스케일링 가능
  - 단점: GPU/CPU 리소스 관리가 필요 (전용 노드 풀, 리소스 쿼터 등)
- **옵션 B – 외부 Embedding API(OpenAI 등) + 경량 Worker**
  - Embedding 연산은 외부 서비스에 맡기고, K8s Pod는 요청 수집·결과 저장만 담당
  - 클러스터 자원 부담이 적고, 비용은 외부 API 사용량에 따라 발생
- **옵션 C – Oracle Embedding / Generative AI**
  - Oracle의 Generative AI Embeddings를 사용해 임베딩을 생성하고,
  - Oracle AI Vector Search에 벡터를 저장·검색
  - 비용 구조는 “입력 문자/토큰 수 기준 과금 + DB 리소스 비용” 조합이며,  
    정확한 단가는 Oracle 공식 가격표/영업을 통해 확인하는 것이 safest

#### 7.3 GPU 및 로컬 개발 환경

- macOS + Kind 기반 로컬 K8s 클러스터에서는:
  - NVIDIA CUDA 기반 GPU 리소스를 K8s Pod에 직접 붙이기 어렵고,
  - Apple Silicon GPU/Neural Engine도 컨테이너에서 활용이 제한적이다.
- 현실적인 전략:
  - **로컬에서는 CPU 기반·소규모 데이터로 논리/플로우 검증**에 집중
  - **운영/스테이징에서는 GPU가 있는 클라우드 K8s 클러스터**(전용 노드 풀)에서 Embedding/LLM 워크로드를 실행

---

### 8. Oracle Embedding vs OpenAI Embedding 선택 고민

#### 8.1 Oracle Embedding (+ AI Vector Search) 사용 시

- **장점**
  - Oracle DB / AI Vector Search와 네이티브 통합 → 네트워크·보안·모니터링 관점에서 단순
  - 같은 OCI/Oracle 생태계 안에서 권한, 감사, 백업, DR 전략을 일관되게 가져갈 수 있음
  - K8s에 별도 GPU 워커를 띄우지 않고도, Embedding 연산과 벡터 인덱스를 Oracle 쪽에서 처리 가능
- **단점**
  - 모델 선택 폭·커뮤니티 에코시스템이 OpenAI 대비 좁을 수 있음
  - 벤더 락인(Oracle 중심 아키텍처)이 강해짐
  - 비용 구조(Embedding 호출 + DB 리소스)를 합쳐서 설계해야 하며, 세부 단가는 시점별 가격표를 확인해야 함

#### 8.2 OpenAI Embedding 사용 시

- **장점**
  - 모델 품질·언어 지원·라이브러리/예제가 풍부하고, 변화 속도가 빠름
  - Embedding 생성자는 OpenAI, 벡터 저장·검색은 Oracle AI Vector Search 또는 pgvector 등으로 분리할 수 있어 **아키텍처 유연성↑**
  - 나중에 벡터 저장소를 교체해도 Embedding 공급자와 비교적 느슨하게 결합 가능
- **단점**
  - OCI ↔ OpenAI API 사이 네트워크 홉이 생겨 레이턴시·보안(민감 데이터 전달) 고려 필요
  - 외부 API 기반 과금 구조로, 사용량이 커지면 체감 비용이 커질 수 있음

#### 8.3 이 프로젝트에서의 전략 제안

- **운영 단순성·Oracle 중심 아키텍처를 우선**한다면:
  - Embedding + Vector Search 모두 **Oracle 스택(Oracle Embedding + Oracle AI Vector Search)** 으로 가져가는 것이 운영 측면에서 가장 깔끔
- **모델 실험/품질/탈락인을 더 중시**한다면:
  - v1에서는 `EmbeddingClient`/`EmbeddingSearchPort` 인터페이스를 두고,
  - 구현체로 **OpenAI Embedding + Oracle AI Vector Search** 조합을 사용
  - 이후 필요 시 `EmbeddingClient` 구현만 Oracle Embedding으로 교체하는 식으로 진화
