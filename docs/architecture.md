# Architecture (Landing)

이 문서는 아키텍처의 첫 진입점입니다. 상세·원문은 아카이브와 통합 요약에서 확인하세요.

- 전체 요약: `docs/architecture_consolidated.md`
- 다이어그램: `docs/architecture-diagrams.md`
- **서비스별 아키텍처**: `services/{service}/ARCHITECTURE.md`
- **에러 처리 아키텍처**: `docs/error_handling_flow.md`
- 운영·배포 요약: `docs/ops_consolidated.md`

핵심 개요:

- 패턴: Redis 기반 스트리밍(Queue/Streams/Pub/Sub/Cache) + gRPC 스트리밍 + Socket 실시간 전달
- 서비스: Socket, STT, Core, LLM, TTS, Redis Cluster, PostgreSQL, Storage/MinIO
- 인터페이스: Socket↔Client, Socket→STT gRPC streaming, Core↔LLM gRPC streaming, Core→Storage gRPC, LLM↔Inference gRPC, Redis, PostgreSQL, MinIO
- STT 결과: Redis Streams와 Redis Pub/Sub에 publish하여 실시간 자막 제공
- Core/LLM 처리: 스트림 즉시 Pub/Sub, Redis Cache APPEND 백업, 문장 단위 Pub/Sub, 완료 시 PostgreSQL 저장; TTS 결과는 Pub/Sub→Socket으로 전달

참고: 비용·리소스 선택 시 `archive/docs/oracle-cloud-always-free.md`의 가이드를 함께 검토하세요.
