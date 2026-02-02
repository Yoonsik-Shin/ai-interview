# 헬스체크 점검 결과

서비스별 readiness/liveness probe 경로·타이밍과 실제 구현을 대조한 점검 결과입니다.

## 1. 경로 불일치 (수정 완료)

| 서비스 | 배포 경로 (기존) | 실제 경로 | 조치 |
|--------|------------------|-----------|------|
| **BFF** | `/health` | `/health/liveness`, `/health/readiness` | prod: readiness→`/health/readiness`, liveness→`/health/liveness` |
| **Socket** (Dockerfile) | HEALTHCHECK `/health` | `/health/liveness`, `/health/readiness` | Dockerfile HEALTHCHECK→`/health/liveness` |

## 2. 서비스별 구현 vs 배포

| 서비스 | Readiness | Liveness | 비고 |
|--------|-----------|----------|------|
| **BFF** | `/health/readiness` | `/health/liveness` | Terminus 기반, 경로 수정 반영 |
| **Socket** | `/health/readiness` (Redis 포함) | `/health/liveness` (메모리) | Redis 미연결 시 readiness 실패 |
| **Core** | `/actuator/health` | `/actuator/health` | Spring Boot Actuator |
| **LLM** | gRPC 50051 | gRPC 50051 | grpc-health, main에서 gRPC+TTS 동시 기동 |
| **STT** | gRPC 50052 | gRPC 50052 | grpc-health |
| **TTS** | gRPC 50053 | gRPC 50053 | grpc-health, Redis consumer와 동시 기동 |
| **Storage** | `/health/ready` (storage_service.running) | `/health` | MinIO 등 초기화 후 ready |
| **Inference** | `/health` | `/health` | FastAPI (gRPC·Kafka·Redis 체크) |

## 3. 타이밍 조정 (적용 완료)

초기화·의존성 연결 시간을 고려해 `initialDelaySeconds`·`timeoutSeconds`·`failureThreshold`를 완화했습니다.

| 서비스 | 변경 요약 |
|--------|-----------|
| **BFF** | timeout 3→5s, failureThreshold 3→5 |
| **Socket** | readiness delay 10→15s, liveness 20→25s, timeout 3→5s, failureThreshold 3→5 |
| **LLM** (prod/local) | readiness delay 10→30s, liveness 15→45s, failureThreshold 3→5 |
| **STT** | readiness delay 15→30s, liveness 30→45s, timeout 3→5s, failureThreshold 3→5 |
| **TTS** | delay 10→15s / 20→25s, timeout 3→5s, failureThreshold 3→5 |
| **Storage** | readiness delay 10→25s, liveness 20→40s, timeout 3→5s, failureThreshold 3→5 |

## 4. 주의사항

- **Socket**: readiness가 Redis 의존. Redis 지연 시 준비 실패할 수 있음.
- **Storage**: readiness는 `storage_service.running`(MinIO 등 초기화 완료) 기준. MinIO 장애 시 ready 안 됨.
- **LLM**: gRPC 서버 + TTS consumer 동시 기동 필요 (`main.py` 수정 반영).
- **TTS**: gRPC Health 기반, HTTP 헬스 포트 없음.

## 5. 참고

- K8s probe: `docs/POD_CRASH_LOCAL_DIAGNOSIS.md`
- BFF/Socket health: `services/{bff,socket}/src/core/health/`
