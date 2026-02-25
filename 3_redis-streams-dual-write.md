# 핵심 기술 의사결정 3: 실시간 트래픽과 데이터 영속성을 분리한 Hybrid Dual-Write 파이프라인 설계

## 1. 배경 및 문제 상황 (실시간성과 영속성의 충돌)

AI 면접 시스템에서 사용자가 음성으로 답변을 제출할 때 시스템은 두 가지 상충되는 목표를 동시에 달성해야 했습니다.

1.  **AI 파이프라인 전달 (Fast Path, 초실시간성)**: 면접관(LLM)이 대답을 늦지 않게 생성할 수 있도록 STT 결과를 단 1ms라도 빨리 Core(오케스트레이터)를 거쳐 LLM으로 넘겨야 합니다.
2.  **안전 보관 (Safe Path, 영속성)**: 면접이 끝난 뒤에 사용자의 답변 오디오 원본이나 자막 데이터를 유실 없이(100% 보장) Object Storage 및 Database에 영구 보존해야 합니다.

### 장애 발생 시나리오

초기에는 이 1번과 2번의 로직을 **동일한 동기식(Synchronous) 단일 파이프라인**에 연결했습니다. `Socket -> STT -> Object Storage 업로드(블로킹) -> DB Insert -> LLM`.
그러나 S3와 같은 Rados 기반 외부 오브젝트 스토리지 영역의 네트워크 I/O나 스토리지 병목(지연 시간)이 고스란히 AI 면접 응답 시간에 반영되었습니다. 심지어 대용량 오디오 청크 업로드 중에 Time-out이 나면, 사용자는 면접관의 답변 자체를 받지 못하고 멈춰버리는 치명적인 결함이 있었습니다.

---

## 2. 해결 방안: Event-Driven 분산 파이프라인 (Hybrid Dual-Write)

실시간 트래픽을 처리하는 경로와 뒷단의 무거운 I/O 작업을 처리하는 경로를 완전히 분리하는 **Dual-Write Architecture**를 채택했습니다.

```text
[ ASCII Art: Hybrid Dual-Write 타임라인 ]

시간 흐름 (ms)
0ms  [User Audio 수신]
      ├──> (Fast Path) Memory -> gRPC -> STT 추론 -> Redis Stream -> Core -> LLM 답변 시작! (초고속)
      │
      └──> (Safe Path) Redis Queue (LPUSH) -> 빠른 응답(ACK) 반환
           ... (Background Queue 대기) ...
           ... Storage Worker 큐 인출 (BLPOP) ...
           ... MinIO 에 파트 업로드 시작 (1~2초 후면 소요) ...
           ... 업로드 완료 후 Kafka Event 발행 (DB 최종 저장)
```

### 2.1 Fast Path (100% 인메모리 파이프라인)

실시간 면접 응답을 위한 핵심 뼈대입니다. 모든 통신이 **메모리(Memory) 레벨 및 gRPC/스트림**으로 처리됩니다.

- `Client Socket -> Node.js Socket -> gRPC -> STT(Python)`: 소켓으로 들어오는 WebM 오디오 청크를 스트리밍으로 STT로 바로 밀어 넣습니다.
- **Redis Streams 적용 (`stt:transcript:stream`)**: 이전에는 단순 Redis Pub/Sub을 썼으나 메시지 순서 보장이나 메시지 유실(Consumer 다운 시) 문제가 있어 `XADD`, `XREAD` 방식의 Redis Streams로 전환했습니다. STT가 텍스트를 스트림에 쏘면, Core 서비스가 즉시 Consume하여 LLM으로 Push 합니다. 외부 DB/Storage는 이 궤적에 관여하지 않습니다.

### 2.2 Safe Path (비동기 안전 저장 파이프라인)

AI 응답 속도에 전혀 영향을 주지 않으면서도 뒷구멍(Background)으로 원본 데이터를 저장합니다.

- **오디오 Redis Queue 격리 (`interview:audio:queue:{id}`)**: Socket 서버는 원본 오디오 청크를 받을 때마다 메모리(Fast Path)와 Redis 큐 공간에 동시에 적재(`LPUSH`)만 해두고 곧바로 응답(ACK)합니다.
- **Storage 백그라운드 Worker (`services/storage`)**: Storage 전용 Worker 컨테이너가 Redis의 큐 데이터를 `BLPOP`으로 꺼내어 합친 뒤, 백그라운드에서 여유롭게 MinIO(Object Storage)로 파트 업로드를 진행합니다.
- 업로드가 완료되면 그제야 Kafka Event (`storage.completed`)를 발행하여 DB와의 Eventual Consistency(최종적 일관성)를 맞춥니다.

---

## 3. 구조적 의의 (Architecture Diagram)

```mermaid
graph TD
    Client["User Audio"] --> Socket["Socket Service"]

    subgraph "Fast Path (Real-time)"
        Socket -->|gRPC Stream| STT["STT Engine"]
        STT -->|XADD (Redis Stream)| RedisStream["stt:transcript"]
        RedisStream -->|Consume| Core["Core Service"]
        Core -->|Push| LLM["LLM (LangGraph)"]
    end

    subgraph "Safe Path (Async Persistence)"
        Socket -->|LPUSH (Queue)| RedisQ["interview:audio:queue"]
        RedisQ -->|BLPOP| StorageWorker["Storage Worker"]
        StorageWorker -->|S3 Upload| ObjectStorage["MinIO / OCI Object Storage"]
        StorageWorker -->|Kafka Event| CoreDB["Core DB (Eventual Update)"]
    end
```

---

## 4. 최종 결과 및 도입 효과

- **스토리지 병목 완벽 차단:** 네트워크 장애나 S3(MinIO) 업로드 지연 등의 외부 변수가 LLM의 응답 및 사용자의 면접 흐름에 개입할 수 있는 "경로" 자체를 끊어버렸습니다. 사용자는 오디오 업로드가 뒷단에 밀려있든 말든, 즉각적으로 STT 텍스트와 LLM의 대답을 들을 수 있게 되었습니다.
- **오디오 유실 원천 방지 (유실률 0%):** Socket 서버가 죽거나 재시작하더라도, 오디오 데이터는 이미 인메모리 Redis 큐(`RPUSH`, `LPUSH`)로 퍼시스턴스화 되어있어, 복구 시 Storage Worker 컨테이너가 남은 청크를 그대로 긁어 담아서 하나의 무결한 `*.webm` 파일로 살려내는 견고성(Resilience)을 입증했습니다.
- **시스템 신뢰성(Reliability) 증대:** Redis Streams를 통한 Consumer Group 관리로 단일 Core 파드가 뻗어도 다른 파드가 메시지를 이어받아(Ack 처리 전 재수신) 텍스트 데이터의 소실을 막는 내결함성(Fault Tolerance)을 완성했습니다.
