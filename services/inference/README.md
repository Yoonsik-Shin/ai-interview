# Inference (Triton) – Archived for Future GPU Tests

이 디렉터리는 향후 Triton 기반 GPU 모델 서빙을 테스트할 때 사용할 예정입니다. 현재 빌드/배포 파이프라인에서는 포함되지 않습니다.

- 주력 오케스트레이션 서비스는 `services/llm` (FastAPI/LangChain/RAG)입니다.
- 로컬/프로덕션 빌드 스크립트는 `services/llm`만 대상으로 합니다.
- Triton 테스트가 필요해지면, 이 디렉터리를 기반으로 별도 배포 경로(`k8s/apps/inference`)를 구성하세요.
