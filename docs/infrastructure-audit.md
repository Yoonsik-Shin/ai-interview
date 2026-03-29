# Redis & Kafka 인프라 전수 조사 보고서

본 문서는 프로젝트 내 분산 인프라(Redis, Kafka)의 사용 현황을 전수 조사하고, `rules.md` 및 아키텍처 원칙과의 정합성을 평가한 결과입니다.

## 1. 아키텍처 요약 (Voice Pipeline)

현재 보이스 파이프라인은 실시간성 확보를 위해 `rules.md`에 명시된 Kafka 대신 **Redis Streams 및 Pub/Sub**을 주로 사용하고 있습니다.

| 구간 | 매체 | 이름 (Key/Topic) | 비고 |
| :--- | :--- | :--- | :--- |
| **STT → Core** | Redis Stream | `interview:stt:transcript:stream` | `rules.md`는 Kafka `UserAnswer` 명시 |
| **Core → LLM** | gRPC Stream | - | 실시간 스트리밍 |
| **Core → Socket** | Redis Pub/Sub | `interview:llm:pubsub:{id}` | 실시간 토큰 전달 |
| **Core → TTS** | Redis Stream | `interview:sentence:stream` | `rules.md`는 Kafka `BotQuestion` 명시 |
| **TTS → Socket** | Redis Pub/Sub | `interview:tts:pubsub:{id}` | 실시간 오디오 전달 |
| **Storage → Core** | Kafka | `storage.completed` | 오디오 파일 업로드 완료 알림 (정합성 일치) |

---

## 2. Redis 인프라 상세 감사

### Track 1 / Track 3 (실시간 데이터 및 상태)
표준 규칙: `domain:resource:action:{id}`

| 구분 | 이름 (Key/Channel) | 상태 | 불일치 및 특이사항 |
| :--- | :--- | :--- | :--- |
| **Stream** | `interview:stt:transcript:stream` | 주의 | 액션 이름(`action`) 누락. `rules.md` 표준화 필요. |
| **Stream** | `interview:sentence:stream` | 주의 | `rules.md`의 `BotQuestion` 토픽 대신 사용 중. |
| **Pub/Sub** | `interview:llm:pubsub:*` | 정상 | 표준 규칙 준수. |
| **Pub/Sub** | `interview:stt:pubsub:*` | 정상 | 표준 규칙 준수. |
| **Pub/Sub** | `interview:tts:pubsub:*` | 정상 | 표준 규칙 준수. |
| **Key** | `interview:session:state:{id}` | 정상 | 세션 상태 관리 (Track 3) |
| **Key** | `interview:audio:queue:{id}` | 정상 | 오디오 데이터 임시 큐 (Track 3) |

---

## 3. Kafka 인프라 상세 감사

### 비동기 이벤트 (Persistence & Logic)

| 토픽 명 | 생산자 | 소비자 | 비고 |
| :--- | :--- | :--- | :--- |
| `storage.completed` | Storage | Interview Core | 표준 규격과 일치. |
| `interview-result` | Core | Resume, Payment | 면접 종료 후 결과 처리용. |
| `document.process` | Core/Portal | Document | 문서(이력서 등) 처리 요청. |
| `document.processed` | Document | Core/Portal | 문서 처리 완료 알림. |
| `interview.messages` | Core | - | 대화 내역 영구 저장을 위한 로그성 토픽. |

---

## 4. 발견된 불일치 요소 및 권장 사항

### [CRITICAL] 보이스 파이프라인 통신 매체 불일치
- **현황**: `rules.md`에는 `UserAnswer` 및 `BotQuestion`을 Kafka로 처리하도록 되어 있으나, 실제 구현은 Redis Streams를 사용함.
- **원인**: 실시간 인터랙티브 환경에서 Kafka의 지연 시간(Latency)보다 Redis의 즉각적인 응답이 유리하기 때문으로 판단됨.
- **권장**: `rules.md`나 `architecture.md`를 **현재의 Redis 기반 실시간 파이프라인으로 현행화**하거나, 필요 시 호환성을 위해 Kafka 브릿지를 구현해야 함.

### [MINOR] Redis 네이밍 일관성 부족
- **현황**: `interview:stt:transcript:stream`와 같이 일부 스트림 이름에 `action` 규격이 명확하지 않음.
- **권장**: `interview:transcript:process:{id}`와 같이 `rules.md` 규격에 최대한 맞춰 점진적 리팩토링 권장.

### [NOTE] 파티션 키 누락 위험
- **현황**: Kafka 발행 시 `sessionId` 또는 `interviewId`를 반드시 파티션 키로 사용하여 순서를 보장해야 함.
- **확인**: `Storage` 서비스 등 일부 생산자에서 `interviewId`가 키로 사용되고 있는지 재점검 필요.
