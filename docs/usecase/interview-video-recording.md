# 면접 영상 녹화 및 다시 보기 기능 설계 문서

## 목차

1. [기능 개요](#1-기능-개요)
2. [설계 원칙 및 결정 사항](#2-설계-원칙-및-결정-사항)
3. [전체 데이터 흐름](#3-전체-데이터-흐름)
4. [API 명세](#4-api-명세)
5. [DB 스키마](#5-db-스키마)
6. [백엔드 아키텍처 (Interview Domain)](#6-백엔드-아키텍처-interview-domain)
7. [BFF 레이어](#7-bff-레이어)
8. [프론트엔드 구현](#8-프론트엔드-구현)
9. [브라우저 복원력 전략](#9-브라우저-복원력-전략)
10. [로컬 vs 프로덕션 스토리지 환경](#10-로컬-vs-프로덕션-스토리지-환경)
11. [향후 확장: CV 분석 파이프라인](#11-향후-확장-cv-분석-파이프라인)
12. [개발자 온보딩 가이드](#12-개발자-온보딩-가이드)

---

## 1. 기능 개요

면접 종료 후 사용자가 자신의 답변 영상을 턴(질문-답변 단위)별로 다시 볼 수 있는 기능.

### 핵심 제약

| 항목 | 결정 | 이유 |
|------|------|------|
| 전송 방식 | WebSocket 스트리밍 ❌, 직접 업로드 ✅ | 면접 중 실시간 스트리밍은 네트워크·성능 부담이 크며, 영상은 면접 종료 후에야 의미가 생김 |
| 녹화 단위 | 전체 연속 녹화 ❌, 턴별 세그먼트 ✅ | 네트워크 끊김 시 전체 유실 방지, 추후 ML 분석의 입력 단위와 일치 |
| 오디오 포함 여부 | 비디오만 ✅ | STT용 오디오 파이프라인(PCM16 WAV)이 이미 별도로 존재. 중복 저장 불필요 |
| 오디오 싱크 | `started_at` / `ended_at` 타임스탬프 저장 | 추후 STT 오디오와 타임스탬프 기반 동기화 가능하도록 여지 확보 |

### 녹화 대상 스테이지

영상 녹화는 사용자가 실제로 답변하는 스테이지에서만 활성화됩니다.

```
CANDIDATE_GREETING → SELF_INTRO → IN_PROGRESS → LAST_ANSWER
```

---

## 2. 설계 원칙 및 결정 사항

### 직접 업로드 (Client → Azure Blob)

```
Frontend → GET /upload-url → presigned PUT URL
Frontend → PUT video.webm → Azure Blob  (BFF/백엔드 경유 없음)
Frontend → POST /complete  → 메타데이터 저장
```

BFF나 백엔드가 영상 데이터를 중계하지 않습니다. 대용량 binary가 서버를 거치지 않으므로 서버 부하가 없습니다.

### 백엔드 허용 오차 (Backend Tolerance)

`GET /recording-segments`는 **존재하는 세그먼트만** 반환합니다. 브라우저 강제 종료 등으로 일부 턴 영상이 유실되더라도 시스템은 정상 동작하며, 프론트엔드는 누락된 turnCount를 "녹화 없음"으로 표시합니다.

### STT 오디오 파이프라인 — 변경 없음

기존 WebSocket → Redis Queue → Storage Service → Azure Blob (PCM16 WAV) 파이프라인은 이 기능과 완전히 병렬로 유지되며, 어떤 변경도 가하지 않습니다.

---

## 3. 전체 데이터 흐름

```
┌─────────────┐              ┌─────────┐         ┌──────────────────┐         ┌──────────────┐
│  Frontend   │              │   BFF   │         │ Interview Domain  │         │  Azure Blob  │
│  (Browser)  │              │ (NestJS)│         │    (Java gRPC)   │         │   Storage    │
└──────┬──────┘              └────┬────┘         └────────┬─────────┘         └──────┬───────┘
       │                          │                       │                           │
       │ [턴 시작 — 사용자 답변 시작]                        │                           │
       │──GET /recording-segments/upload-url?turn=N──────>│                           │
       │                          │──gRPC GetRecordingSegmentUploadUrl─────────────>  │
       │                          │  (objectKey 생성, Storage gRPC GetPresignedUrl)   │
       │                          │<─────────────────────────────────────────────────│
       │<── { uploadUrl, objectKey } ─────────────────────│                           │
       │                          │                       │                           │
       │ [턴 진행 중]                │                       │                           │
       │ MediaRecorder 녹화 시작     │                       │                           │
       │ 청크 → IndexedDB 누적        │                       │                           │
       │                          │                       │                           │
       │ [턴 종료 — 사용자 답변 완료]  │                       │                           │
       │──PUT video.webm ─────────────────────────────────────────────────────────>  │
       │<── 200 OK ────────────────────────────────────────────────────────────────  │
       │──POST /recording-segments/complete─────────────>│                           │
       │                          │──gRPC CompleteRecordingSegmentUpload──────────>  │
       │                          │  interview_recording_segments 테이블에 저장         │
       │<── { success: true } ────────────────────────────│                           │
       │                          │                       │                           │
       │ [면접 종료 후 — 다시 보기]   │                       │                           │
       │──GET /recording-segments─────────────────────── >│                           │
       │                          │──gRPC GetInterviewRecordingSegments────────────> │
       │                          │  각 objectKey → Storage GetPresignedUrl (GET)    │
       │                          │<──────────────────────────────────────────────── │
       │<── [{ turnCount, recordingUrl, expiresAt }, ...]─│                           │
```

---

## 4. API 명세

모든 엔드포인트는 `Authorization: Bearer {accessToken}` 헤더가 필요합니다.

### 4-1. 업로드 URL 발급

```
GET /api/v1/interviews/:id/recording-segments/upload-url?turn={n}
```

**경로 파라미터**

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `id` | string (UUID) | 면접 세션 ID |

**쿼리 파라미터**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `turn` | integer | ✅ | 현재 턴 번호 (1부터 시작) |

**응답 200**

```json
{
  "uploadUrl": "https://storage.blob.core.windows.net/...",
  "objectKey": "interviews/{interviewId}/video/turn-{n}/{uuid}.webm"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `uploadUrl` | string | Azure Blob presigned PUT URL (TTL: 10분) |
| `objectKey` | string | 저장소 내 객체 경로 — complete 요청 시 그대로 사용 |

**에러**

| 코드 | 사유 |
|------|------|
| 404 | 면접 세션 없음 |
| 500 | Storage gRPC 서비스 응답 실패 |

---

### 4-2. 업로드 완료 신고

```
POST /api/v1/interviews/:id/recording-segments/complete
```

**요청 바디**

```json
{
  "objectKey": "interviews/{id}/video/turn-1/{uuid}.webm",
  "turnCount": 1,
  "durationSeconds": 42,
  "startedAtEpoch": 1711234567890,
  "endedAtEpoch": 1711234609890
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `objectKey` | string | ✅ | upload-url 발급 시 수신한 objectKey |
| `turnCount` | integer | ✅ | 업로드된 턴 번호 |
| `durationSeconds` | integer | ❌ | 녹화 길이(초) |
| `startedAtEpoch` | long | ❌ | 녹화 시작 시각 (epoch ms) |
| `endedAtEpoch` | long | ❌ | 녹화 종료 시각 (epoch ms) |

**응답 200**

```json
{ "success": true }
```

---

### 4-3. 세그먼트 목록 조회 (다시 보기)

```
GET /api/v1/interviews/:id/recording-segments
```

**응답 200**

```json
[
  {
    "turnCount": 1,
    "recordingUrl": "https://storage.blob.core.windows.net/...",
    "expiresAt": 1711238167890
  },
  {
    "turnCount": 2,
    "recordingUrl": "https://storage.blob.core.windows.net/...",
    "expiresAt": 1711238167891
  }
]
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `turnCount` | integer | 턴 번호 (오름차순 정렬) |
| `recordingUrl` | string | Azure Blob presigned GET URL (TTL: 1시간) |
| `expiresAt` | long | URL 만료 시각 (epoch ms) |

> **주의**: Storage gRPC 장애 등으로 일부 세그먼트의 URL 생성에 실패하면 해당 세그먼트는 응답에서 제외됩니다. 클라이언트는 중간 turnCount가 빠져있을 수 있음을 고려해야 합니다.

---

## 5. DB 스키마

**테이블: `interview_recording_segments`**
Migration: `V002__add_interview_recording_segments.sql`

```sql
CREATE TABLE interview_recording_segments (
    id                   UUID PRIMARY KEY,
    interview_session_id UUID NOT NULL,
    turn_count           INTEGER NOT NULL,
    object_key           VARCHAR(1024) NOT NULL,
    duration_seconds     INTEGER,
    started_at           TIMESTAMP WITH TIME ZONE,
    ended_at             TIMESTAMP WITH TIME ZONE,
    analysis_status      VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at           TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT fk_recording_segments_session
        FOREIGN KEY (interview_session_id) REFERENCES interview_session(id)
);

CREATE INDEX idx_recording_segments_session_id
    ON interview_recording_segments(interview_session_id);
```

| 컬럼 | 설명 |
|------|------|
| `turn_count` | 면접 내 답변 순서 (1부터) |
| `object_key` | Azure Blob 저장 경로 (`interviews/{id}/video/turn-{n}/{uuid}.webm`) |
| `started_at` / `ended_at` | 추후 STT 오디오와 타임스탬프 기반 싱크용 |
| `analysis_status` | `PENDING` → `COMPLETED` / `FAILED` (CV 분석 파이프라인용, 현재는 PENDING 고정) |

---

## 6. 백엔드 아키텍처 (Interview Domain)

헥사고날 아키텍처(Ports & Adapters)를 따릅니다.

```
adapter/in/grpc/
  └── InterviewGrpcController.java          # gRPC 진입점 (3개 메서드 추가)

application/port/in/
  ├── GetUploadUrlForSegmentUseCase.java     # 업로드 URL 발급
  ├── CompleteSegmentUploadUseCase.java      # 업로드 완료 저장
  └── GetInterviewRecordingSegmentsUseCase.java  # 세그먼트 목록 조회

application/port/out/
  ├── GetSegmentStorageUrlPort.java          # Storage gRPC presigned URL 요청
  ├── SaveRecordingSegmentPort.java          # 세그먼트 메타데이터 저장
  └── LoadRecordingSegmentsPort.java         # 세그먼트 목록 로드

application/interactor/
  ├── GetUploadUrlForSegmentInteractor.java
  ├── CompleteSegmentUploadInteractor.java
  └── GetInterviewRecordingSegmentsInteractor.java

domain/entity/
  └── InterviewRecordingSegment.java

domain/enums/
  └── SegmentAnalysisStatus.java             # PENDING | COMPLETED | FAILED

adapter/out/persistence/
  ├── InterviewRecordingSegmentJpaEntity.java
  ├── InterviewRecordingSegmentPersistenceAdapter.java  # SaveRecordingSegmentPort + LoadRecordingSegmentsPort 구현
  └── repository/InterviewRecordingSegmentJpaRepository.java

adapter/out/grpc/
  └── StorageGrpcAdapter.java                # GetSegmentStorageUrlPort 구현 (@GrpcClient("storage-service"))
```

### objectKey 생성 규칙

```
interviews/{interviewId}/video/turn-{turnCount}/{uuid}.webm
```

`GetUploadUrlForSegmentInteractor`에서 UUID를 생성하여 매 요청마다 고유한 경로를 만듭니다. 같은 turnCount라도 재요청 시 다른 objectKey가 생성됩니다.

### Proto (interview/v1/interview.proto)

```protobuf
rpc GetRecordingSegmentUploadUrl (GetRecordingSegmentUploadUrlRequest)
    returns (GetRecordingSegmentUploadUrlResponse);

rpc CompleteRecordingSegmentUpload (CompleteRecordingSegmentUploadRequest)
    returns (CompleteRecordingSegmentUploadResponse);

rpc GetInterviewRecordingSegments (GetInterviewRecordingSegmentsRequest)
    returns (GetInterviewRecordingSegmentsResponse);
```

Proto 수정 후 반드시 재컴파일:

```bash
cd services/domains
./gradlew :interview:generateProto
```

---

## 7. BFF 레이어

**서비스**: `services/gateways/bff` (NestJS)

```
modules/interview/
  usecases/
    ├── get-recording-segment-upload-url.usecase.ts
    ├── complete-recording-segment.usecase.ts
    └── get-recording-segments.usecase.ts

infra/grpc/services/
  └── interview-grpc.service.ts   # gRPC 클라이언트 메서드 3개 추가
```

BFF는 REST ↔ gRPC 변환만 담당합니다. 영상 데이터는 BFF를 경유하지 않습니다.

---

## 8. 프론트엔드 구현

### 파일 구조

```
frontend/src/
  lib/
    └── recordingStorage.ts     # IndexedDB 추상화 모듈
  hooks/
    └── useVideoRecorder.ts     # 턴별 비디오 녹화 훅
  pages/
    └── Interview.tsx           # 기존 페이지에 훅 연동
```

### `useVideoRecorder` 훅 API

```ts
const { startSegment, stopSegment, recoverPendingUploads } =
  useVideoRecorder(interviewId, streamRef);
```

| 함수 | 시점 | 동작 |
|------|------|------|
| `startSegment(turnCount)` | 사용자 답변 시작 (`startRecording` 내부) | 업로드 URL 발급 → IndexedDB에 메타 저장 → MediaRecorder 시작 (2초 단위 청크) |
| `stopSegment()` | 사용자 답변 완료 (`stopRecording` 내부) | MediaRecorder 중단 → 청크 조립 → Azure Blob PUT (재시도 포함) → complete 신고 → IndexedDB 정리 |
| `recoverPendingUploads()` | 컴포넌트 mount 시 | IndexedDB의 미완료 세그먼트 탐지 후 재업로드 |

### `recordingStorage.ts` — IndexedDB 스키마

```
DB: "interview-recordings" (version 1)
├── Store: "segments"  key: [interviewId, turnCount]
│   └── PendingSegment { interviewId, turnCount, uploadUrl, objectKey, expiresAt, status }
└── Store: "chunks"    key: "{interviewId}_{turnCount}_{index}"
    └── { key, interviewId, turnCount, index, chunk: Blob }
```

### Interview.tsx 연동 포인트

```ts
// 1. 훅 초기화
const { startSegment, stopSegment, recoverPendingUploads } =
  useVideoRecorder(id, streamRef);

// 2. 컴포넌트 mount 시 미완료 업로드 복구
useEffect(() => {
  recoverPendingUploads().catch(console.error);
  // ...
}, [...]);

// 3. 답변 시작 시 녹화 시작 (답변 스테이지에서만)
const startRecording = useCallback(async () => {
  // ... 오디오 녹화 시작 ...
  if (answerStages.includes(currentStageRef.current)) {
    const turn = ++turnCountRef.current;
    startSegment(turn).catch(console.error);
  }
}, [...]);

// 4. 답변 완료 시 녹화 종료
const stopRecording = useCallback(() => {
  // ... 오디오 녹화 종료 ...
  stopSegment().catch(console.error);
}, [...]);
```

### 다시 보기 UI (InterviewReport.tsx)

면접 완료 후 리포트 페이지(`/interviews/:id/reports/:reportId`) 하단에 영상 다시 보기 섹션이 표시됩니다.

**동작 흐름:**

```
리포트 generationStatus = COMPLETED
  → GET /v1/interviews/:id/recording-segments
  → segments > 0: 섹션 표시 / 0: 섹션 숨김
  → 첫 번째 턴 자동 선택 → <video> 플레이어 로드
```

**UI 구조:**

```
┌─ 영상 다시 보기 ─────────────────────────────┐
│                                              │
│  [턴 1] [턴 2] [턴 3] ...                    │
│   ^^^^  (선택된 턴: 초록 하이라이트)           │
│  ┌─────────────────────────────────────────┐ │
│  │                                         │ │
│  │            <video controls>             │ │
│  │                                         │ │
│  └─────────────────────────────────────────┘ │
│  ← 이전 턴                       다음 턴 →   │
└──────────────────────────────────────────────┘
```

**엣지 케이스 처리:**

| 케이스 | 처리 |
| --- | --- |
| 세그먼트 0개 | 섹션 전체 숨김 |
| 일부 턴 누락 (중간 번호 빠짐) | 존재하는 턴만 버튼 렌더링 |
| presigned URL 만료 (1시간 TTL) | `<video onError>` → `getRecordingSegments` 재호출로 URL 갱신 |
| 리포트 PENDING 중 | 세그먼트 로드 안 함 (COMPLETED 전환 시 트리거) |

**관련 파일:**

```
frontend/src/
  api/
    └── interview.ts         # getRecordingSegments() + RecordingSegment 타입
  pages/
    ├── InterviewReport.tsx          # 영상 다시 보기 섹션
    └── InterviewReport.module.css   # turnSelector, videoPlayer, turnNav 스타일
```

---

## 9. 브라우저 복원력 전략

면접 중 브라우저가 새로고침되거나 창이 닫힐 경우를 대비한 3단계 전략입니다.

### 단계 1: 청크 단위 IndexedDB 저장 (정상 흐름)

`MediaRecorder`는 2초마다 `ondataavailable` 이벤트를 발생시키며, 각 청크는 즉시 IndexedDB에 저장됩니다. 업로드 전에 메모리가 아닌 영구 저장소에 보관됩니다.

### 단계 2: pagehide 이벤트 핸들러 (best-effort)

```ts
window.addEventListener("pagehide", () => {
  if (recorder.state === "recording") {
    // IndexedDB에 pending 상태로 기록
    recorder.stop(); // 마지막 청크 flush
  }
});
```

브라우저 unload 시 대용량 fetch는 차단될 수 있으므로 **업로드는 보장하지 않습니다**. 청크를 IndexedDB에 남겨두는 것이 목표입니다.

### 단계 3: 재진입 시 자동 복구

```ts
// Interview.tsx mount 시
recoverPendingUploads();
```

```
IndexedDB에서 status=pending 세그먼트 탐색
  ├── chunks 있음 + URL 유효 → 즉시 재업로드
  ├── chunks 있음 + URL 만료 → 새 URL 발급 → 재업로드
  └── chunks 없음 → IndexedDB 항목 삭제
```

업로드 재시도는 exponential backoff(1초 → 3초 → 7초, 최대 4회)로 수행됩니다.

### 장애 허용 매트릭스

| 시나리오 | 결과 |
|---------|------|
| 업로드 중 일시적 네트워크 끊김 | 자동 재시도 (최대 4회) |
| 답변 중 브라우저 새로고침 | 재진입 시 IndexedDB에서 복구 후 재업로드 |
| 창 강제 종료 | pagehide로 청크 flush 시도, 재진입 시 복구 |
| 일부 턴 영상 유실 | 서버는 존재하는 세그먼트만 반환, 시스템 정상 동작 |
| Storage gRPC 장애 | 업로드 URL 발급 실패 → 500 에러 반환 (세그먼트 생략) |

---

## 10. 로컬 vs 프로덕션 스토리지 환경

### Storage Service 추상화

Storage Service(`services/infra/storage`)는 `AZURE_STORAGE_CONNECTION_STRING` 환경변수 유무로 스토리지 엔진을 자동 선택합니다.

| 환경 | 스토리지 | presigned URL 형식 |
| --- | --- | --- |
| 로컬 (MinIO) | `AZURE_STORAGE_CONNECTION_STRING` 미설정 | `http://minio.localhost/{bucket}/{object}?X-Amz-...` |
| 프로덕션 (Azure) | `AZURE_STORAGE_CONNECTION_STRING` 설정 | `https://{account}.blob.core.windows.net/{container}/{object}?sv=...` |

백엔드(Interview Domain)의 `StorageGrpcAdapter`와 인터랙터들은 gRPC 인터페이스만 호출하므로 **환경과 무관하게 동일하게 동작**합니다.

### 로컬 환경 구성

MinIO는 `k8s/infra/minio/` 매니페스트로 배포되며 `minio.localhost:9000`으로 노출됩니다.

#### 필수 환경변수 (Storage Service)

```bash
OBJECT_STORAGE_ENDPOINT=http://minio.unbrdn.svc.cluster.local:9000   # 내부 gRPC용
OBJECT_STORAGE_PUBLIC_ENDPOINT=http://minio.localhost                  # 브라우저 직접 업로드용
OBJECT_STORAGE_BUCKET=interview-archives
AZURE_STORAGE_CONNECTION_STRING=                                        # 비워두면 MinIO 사용
```

> `OBJECT_STORAGE_PUBLIC_ENDPOINT`가 설정되지 않으면 내부 클러스터 주소(`minio.unbrdn.svc.cluster.local`)가 포함된 presigned URL이 브라우저에 전달되어 업로드가 실패합니다.

### PUT 요청 헤더 호환성

Azure Blob은 PUT 요청에 `x-ms-blob-type: BlockBlob` 헤더가 없으면 400을 반환합니다. MinIO는 이 헤더를 무시합니다.

`useVideoRecorder.ts`에서는 URL 형식으로 환경을 판별해 조건부로 헤더를 추가합니다.

```ts
const isAzure = uploadUrl.includes("blob.core.windows.net");
const headers = {
  "Content-Type": "video/webm",
  ...(isAzure ? { "x-ms-blob-type": "BlockBlob" } : {}),
};
```

기존 Resume 업로드(`resumes.ts`)도 동일한 패턴을 따릅니다.

---

## 11. 향후 확장: CV 분석 파이프라인

`analysis_status` 컬럼은 이 파이프라인을 위해 예약되어 있습니다.

```
현재: interview_recording_segments.analysis_status = 'PENDING'

추후:
  CV 분석 서비스
    → objectKey로 영상 다운로드
    → 시선처리 / 자세 / 표정 분석
    → analysis_status = 'COMPLETED'
    → 분석 결과 → 면접 리포트에 반영
```

분석 파이프라인 도입 시 `started_at` / `ended_at` 타임스탬프를 활용해 STT 오디오(`interview_audio_segments`)와 시간축 기반 정합이 가능합니다.

---

## 12. 개발자 온보딩 가이드

### 로컬 환경에서 기능 확인

**1. DB Migration 확인**

```bash
# interview 서비스 기동 후 테이블 생성 여부 확인
psql -c "\d interview_recording_segments"
```

**2. 업로드 URL 발급 테스트**

```bash
TOKEN="<accessToken>"
INTERVIEW_ID="<interviewId>"

curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/v1/interviews/$INTERVIEW_ID/recording-segments/upload-url?turn=1"

# 응답 예시
# { "uploadUrl": "https://...", "objectKey": "interviews/.../turn-1/....webm" }
```

**3. 실제 업로드 테스트**

```bash
# 위에서 받은 uploadUrl로 직접 PUT
curl -X PUT \
  --data-binary @test.webm \
  "https://<uploadUrl>"
# → 201 Created (Azure Blob)
```

**4. 완료 신고 테스트**

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"objectKey":"interviews/.../turn-1/....webm","turnCount":1,"durationSeconds":30}' \
  "http://localhost:8080/api/v1/interviews/$INTERVIEW_ID/recording-segments/complete"

# interview_recording_segments 테이블에 row 삽입 확인
psql -c "SELECT * FROM interview_recording_segments;"
```

**5. 다시 보기 테스트**

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/v1/interviews/$INTERVIEW_ID/recording-segments"

# 반환된 recordingUrl을 브라우저에서 열어 영상 재생 확인
```

### 코드 변경 시 주의사항

| 변경 사항 | 해야 할 일 |
|----------|-----------|
| `interview.proto` 수정 | `./gradlew :interview:generateProto` 실행 후 빌드 |
| DB 스키마 변경 | `V003__...sql` 신규 파일 추가 (V002 수정 금지) |
| 새로운 포트 추가 | 반드시 `application/port/` 하위에 인터페이스 작성, 어댑터가 구현 |
| BFF gRPC 메서드 추가 | `interview-grpc.service.ts` → `interview.controller.ts` → `interview.module.ts` 순서로 추가 |

### IndexedDB 디버깅 (브라우저)

1. Chrome DevTools → Application → IndexedDB → `interview-recordings`
2. `segments` 스토어: status가 `pending`으로 남은 항목 = 업로드 실패/미완료
3. `chunks` 스토어: 해당 세그먼트의 바이너리 청크들

### 관련 파일 인덱스

| 레이어 | 파일 경로 |
|--------|---------|
| DB Migration | `services/domains/interview/src/main/resources/db/migration/postgresql/V002__add_interview_recording_segments.sql` |
| Domain Entity | `...interview/domain/entity/InterviewRecordingSegment.java` |
| Ports (in) | `...interview/application/port/in/{Get,Complete,GetSegments}*.java` |
| Ports (out) | `...interview/application/port/out/{GetSegmentStorageUrlPort,SaveRecordingSegmentPort,LoadRecordingSegmentsPort}.java` |
| Interactors | `...interview/application/interactor/{GetUploadUrl,CompleteSegment,GetInterviewRecordingSegments}Interactor.java` |
| Storage Adapter | `...interview/adapter/out/grpc/StorageGrpcAdapter.java` |
| Persistence Adapter | `...interview/adapter/out/persistence/InterviewRecordingSegmentPersistenceAdapter.java` |
| gRPC Controller | `...interview/adapter/in/grpc/InterviewGrpcController.java` |
| Proto | `services/proto/interview/v1/interview.proto` |
| BFF gRPC Client | `services/gateways/bff/src/infra/grpc/services/interview-grpc.service.ts` |
| BFF Usecases | `services/gateways/bff/src/modules/interview/usecases/{get-recording-segment-upload-url,complete-recording-segment,get-recording-segments}.usecase.ts` |
| BFF Controller | `services/gateways/bff/src/modules/interview/interview.controller.ts` |
| FE IndexedDB | `frontend/src/lib/recordingStorage.ts` |
| FE Hook | `frontend/src/hooks/useVideoRecorder.ts` |
| FE 면접 진행 | `frontend/src/pages/Interview.tsx` |
| FE 다시 보기 UI | `frontend/src/pages/InterviewReport.tsx` |
| FE 다시 보기 스타일 | `frontend/src/pages/InterviewReport.module.css` |
| FE API 클라이언트 | `frontend/src/api/interview.ts` |
