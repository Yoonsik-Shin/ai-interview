## 이력서 중복 방지 및 Vector 검색 아키텍처

이 프로젝트는 이력서 업로드 시 **정밀 일치(Exact Match)**와 **의미론적 유사도(Semantic Match)**를 동시에 검증하여 중복 데이터를 방지하고, 유효한 이력서만 처리하는 지능형 파이프라인을 구축했습니다.

---

### 1. 중복 감지 레이어 (Dual-Layer Validation)

#### 1.1 Exact Match (파일 해시)

- **알고리즘**: SHA-256
- **목적**: 완전히 동일한 파일이 중복 업로드되는 것을 즉각 차단합니다.
- **구현**: `UploadResumeInteractor`에서 파일 바이트 데이터를 기반으로 해시를 계산하여 DB의 `file_hash` 컬럼과 비교합니다.

#### 1.2 Semantic Match (벡터 유사도)

- **모델**: OpenAI `text-embedding-3-small` (1536차원)
- **목적**: 내용은 거의 같으나 파일 형식이 다르거나 미세하게 수정된 이력서를 감지합니다.
- **임계치(Threshold)**: 코사인 유사도 0.95 (95% 이상 일치 시 유사 이력서로 간주)
- **하이브리드 지원**:
  - **Local**: `pgvector`를 활용한 코사인 거리 연산 (`1 - (embedding <=> ?::vector)`)
  - **Prod**: `Oracle AI Search`의 `VECTOR_DISTANCE` 함수 활용

---

### 2. 개인정보 보호 (Frontend-side PII Masking)

LLM을 통한 유효성 검사 및 임베딩 생성 과정에서 민감한 정보를 보호하기 위해 프론트엔드에서 1차 가공을 거칩니다.

- **텍스트 추출**: 브라우저에서 `pdfjs-dist`(PDF) 및 `mammoth`(Word)를 사용하여 텍스트를 직접 추출합니다.
- **마스킹 대항**: 이메일, 전화번호, 상세 주소 등을 정규식을 통해 `[EMAIL]`, `[PHONE]`, `[ADDRESS]` 등으로 치환합니다.
- **유효성 검사**: 마스킹된 텍스트를 BFF의 `validate-content` API로 전송하여 "이력서 여부"를 판별합니다.

---

### 3. 전체 업로드 및 검증 흐름

1.  **Frontend**:
    - 파일 선택 시 텍스트 추출 및 **Transformers.js 로컬 AI 판별** 수행.
    - AI 매칭률이 낮을 경우 사용자에게 경고 및 BFF를 통한 2차 검증 수행.
    - 모든 로컬/BFF 검증 통과(또는 사용자 승인) 시 스토리지 업로드.
2.  **Core Service**:
    - 업로드 완료(`Complete`) 요청 수신 시 **SHA-256 해시** 및 **벡터 유사도** 최종 체크.
    - 검증 실패 시 **스토리지 파일 자동 삭제(Cleanup)** 및 예외 발생.
    - 모든 검증 통과 시 `Resumes` 엔티티 저장 (해시, 임베딩 포함).

---

### 4. 데이터베이스 및 인프라 설계

#### 4.1 하이브리드 벡터 검색 구조

애플리케이션(Core) 레이어에서는 `SearchResumeByVectorPort` 인터페이스를 사용하여 인프라를 추상화했습니다.

- **PostgreSQL (Local)**:
  ```sql
  SELECT id FROM resumes
  WHERE user_id = ? AND (1 - (embedding <=> ?::vector)) >= 0.95
  ORDER BY embedding <=> ?::vector LIMIT 1
  ```
- **Oracle (Production)**:
  ```sql
  SELECT id FROM resumes
  WHERE user_id = ? AND (1 - VECTOR_DISTANCE(embedding, TO_VECTOR(?), COSINE)) >= 0.95
  ORDER BY VECTOR_DISTANCE(embedding, TO_VECTOR(?), COSINE)
  FETCH FIRST 1 ROWS ONLY
  ```

#### 4.2 주요 설정

- **Proto**: `llm.proto`에 `GetEmbedding` RPC 추가
- **Migration**:
  - Oracle: `V010__add_file_hash_to_resumes.sql`
  - PostgreSQL: `V004__add_file_hash_and_embedding_to_resumes.sql`

---

### 5. 향후 계획

- **RAG 연동**: 저장된 `embedding` 정보를 활용하여 면접 세션 중 PDF 원문 내용을 지식 베이스로 활용하는 RAG(Retrieval-Augmented Generation) 파이프라인 정교화
- **유사도 임계치 튜닝**: 사용자 피드백에 따라 95% 임계치를 유연하게 조정할 수 있는 설정값(Config) 도입
- **PII 마스킹 고도화**: 단순 정규식을 넘어선 NLP 기반 민감 정보 탐지 적용
