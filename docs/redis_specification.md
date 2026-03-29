# Redis 3-Track Specification (Standardized)

Redis 3-Track 아키텍처의 데이터 모델, 키 네이밍 규칙 및 채널 설정을 정의합니다.

## 1. 개요 (3-Track 구조)

| 트랙 | 목적 | 데이터 특성 | 기술적 구현 |
| :--- | :--- | :--- | :--- |
| **Track 1** | **실시간 브로드캐스트** | 고빈도, 저지연, 휘발성 | Pub/Sub, String (Buffer), Hash |
| **Track 2** | **LLM 추론 컨텍스트** | 세션 주기, 반정형 | LangGraph Checkpoint (Hash) |
| **Track 3** | **비즈니스 상태 & 이벤트** | 신뢰성 필요, 이벤트 스트림 | Redis Streams, Hash |

---

## 2. 세부 사양

### Track 1: 실시간 제어 및 데이터 전송

| 키/채널 | 타입 | 주체 | 설명 |
| :--- | :--- | :--- | :--- |
| `interview:llm:pubsub:{id}` | **Pub/Sub** | Core | AI 응답 토큰 전송 (타이핑 효과) |
| `interview:stt:pubsub:{id}` | **Pub/Sub** | STT | 사용자 발화 텍스트 (UI 자막 전용) |
| `interview:tts:pubsub:{id}` | **Pub/Sub** | TTS | 생성된 음성 데이터 (Base64) 전송 |
| `interview:llm:buffer:{id}` | String | Core | 문장 조립용 임시 토큰 버퍼 |
| `interview:rt:{id}` | Hash | Socket | 면접 실시간 제어 상태 (`status=LISTENING`, `selfIntroStart`) — Core stage에서 파생, Socket이 gRPC 결과 수신 후 설정 |
| `interview:session:{id}` | Hash | Socket | Socket 연결 메타 (`connectedAt`, `userId`, `lastActivity`) — 면접 비즈니스 로직과 무관 |

> [!NOTE]
> `interview:rt:{id}`는 Core의 `interview:session:hash:{id}`(Track 3)에서 파생된 Socket 전용 캐시입니다. MSA 원칙상 Socket은 Core의 Track 3에 직접 접근하지 않으며, 필요한 상태는 Track 1에 별도로 유지합니다.

### Track 2: LangGraph 추론 상태

| 키 | 타입 | 주체 | 설명 |
| :--- | :--- | :--- | :--- |
| `checkpoint:{thread_id}` | Hash | LLM | LangGraph 체크포인트 (RedisSaver) |

### Track 3: 인터뷰 상태 및 백엔드 파이프라인

| 키 | 타입 | 주체 | 설명 |
| :--- | :--- | :--- | :--- |
| `interview:session:hash:{id}` | Hash | Core | 인터뷰 비즈니스 상태 (stage, turnCount, difficulty 등) — Core 전용 |
| `interview:sentence:stream` | Streams | Core | 완성된 문장 데이터 (TTS 및 DB 저장 큐) |

---

## 3. 구현 가이드라인

### 채널 네이밍 규칙

- 모든 실시간 채널은 `interview:{service}:pubsub:{interviewId}` 형식을 따릅니다.
- 환경 변수(`TEMPLATE` 등)를 통해 동적으로 설정되어야 합니다.

### 키 소유권 원칙

- `interview:session:hash:{id}` (Track 3) 는 Core 전용입니다. Socket은 이 키에 직접 접근하지 않습니다.
- Socket의 실시간 상태는 Track 1의 `interview:rt:{id}`, `interview:session:{id}`로 관리합니다.

### 데이터 흐름

1. **STT**: STT 서비스 → `interview:stt:pubsub:{id}` → Socket Gateway → Client
2. **LLM**: Core 서비스 → `interview:llm:pubsub:{id}` → Socket Gateway → Client
3. **TTS**: Core (Stream) → TTS 서비스 → `interview:tts:pubsub:{id}` → Socket Gateway → Client

> [!NOTE]
> `interview:sentence:stream`은 전역 스트림으로 운영되며, 각 메시지는 내부의 `interviewId`를 통해 식별됩니다. TTS 서비스와 CoreDbSaverWorker가 각각 별도의 consumer group으로 구독합니다.
>
> `interview:llm:buffer:{id}`는 Track 1에 위치하여 입출력 성능을 최적화합니다.
