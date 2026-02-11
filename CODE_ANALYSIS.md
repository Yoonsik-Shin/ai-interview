# 코드 및 문서 분석 보고서 (Code Analysis Report)

이 보고서는 현재 프로젝트의 코드베이스와 문서를 분석하여 불필요한 코드, 문서와의 불일치 사항, 그리고 개선이 필요한 지점들을 정리한 것입니다.

## 1. 불필요한 코드 및 서비스 (Unused Code & Services)

### 🚨 `services/inference` 디렉토리 (삭제 권장)

- **현상**: `services/inference` 내부에는 FastAPI 기반의 `interview` 및 `tts` 엔드포인트가 구현되어 있습니다 (`main.py`). 이는 현재의 MSA 아키텍처인 `services/llm` (gRPC 기반 LLM 처리) 및 `services/tts` (Kafka 기반 TTS 처리)와 중복됩니다.
- **분석**: `inference` 서비스는 리팩토링 이전의 구형 모놀리식(Python) 서비스로 보입니다. 문서(`architecture_consolidated.md`)에서는 `inference`를 "Triton GPU 모델 서빙" 용도로 정의하고 있으나, 실제 코드는 OpenAI/EdgeTTS를 사용하는 구형 로직입니다.
- **권장**: `services/inference` 디렉토리 전체를 삭제하거나 아카이브로 이동하고, `k8s/apps/inference` 매니페스트가 있다면 함께 정리해야 합니다.

### 🗑️ Legacy Resume Upload (삭제 권장)

- **현상**: 이력서 업로드가 "Presigned URL" 방식(`getUploadUrl` -> `completeUpload`)으로 전환되었으나, "파일 직접 전송" 방식의 Legacy 코드가 전 구간에 남아있습니다.
- **관련 파일**:
  - **Frontend**: `src/api/resumes.ts` 내 `uploadResumeLegacy` 함수. (현재 `ResumeUploadZone.tsx`는 이 함수를 사용하지 않음)
  - **BFF**: `resume.controller.ts`의 `@Post("upload")` 및 `resume.service.ts`의 `uploadResume`.
  - **Core**: `ResumeGrpcController.java`의 `uploadResume` 메서드 및 관련 `UploadResumeCommand/UseCase`.
  - **Proto**: `resume.proto`의 `rpc UploadResume`.
- **권장**: 위 코드들을 안전하게 제거하여 유지보수 복잡도를 낮춰야 합니다. (`updateResume`은 이력서 수정 시 사용되므로 유지 필요)

## 2. 문서와 코드의 간극 (Documentation Gaps)

### `services/inference`의 정체성 혼란

- **문서**: `docs/architecture_consolidated.md`는 `inference` 서비스를 "Triton Server (Optional)"로 명시.
- **코드**: 실제 `services/inference`는 구형 LLM API 서버.
- **해결**: `services/inference`를 삭제하고, 추후 Triton 도입 시 새로운 구조로 생성하는 것이 바람직합니다.

### 13단계 인터뷰 플로우 (확인됨)

- **코드**: `frontend/src/pages/Interview.tsx` 및 `hooks/useInterviewSocket.ts`에서 `InterviewStage` Enum을 통해 `GREETING`, `SELF_INTRO`, `INTERVIEWER_INTRO`, `LAST_QUESTION_PROMPT` 등의 단계가 잘 구현되어 있음을 확인했습니다.
- **문서**: 아키텍처 문서에도 해당 흐름이 반영되어 있으나, 구체적인 스테이트 머신(State Machine) 다이어그램이 문서화되면 더 좋을 것입니다.

## 3. Frontend - Backend 관계 분석

### 데이터 흐름

- **Backend (BFF/Core) → Frontend**:
  - BFF는 Core gRPC 및 LLM gRPC의 응답을 REST API로 변환하여 Frontend에 제공합니다.
  - 대부분의 실시간 데이터(자막, 오디오, 인터셉트 등)는 `Socket Service`를 통해 WebSocket 이벤트로 전달됩니다.
- **Frontend → Backend**:
  - API 호출은 `api/client.ts`를 통해 BFF로 향합니다.
  - 오디오 스트리밍은 `useAudioRecorder` 훅을 통해 `Socket Service`로 바이너리 청크를 전송합니다.

### 결론

현재 아키텍처는 **REST(비실시간 제어) + WebSocket(실시간 통신) + gRPC(내부 통신)**의 하이브리드 패턴을 잘 따르고 있습니다. 다만, 리팩토링 과정에서 남겨진 `inference` 서비스와 `Legacy Upload` 코드는 시스템의 혼란을 가중시킬 수 있으므로 정리가 시급합니다.
