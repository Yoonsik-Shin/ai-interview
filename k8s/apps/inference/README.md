# Inference (Triton) Manifests

이 경로는 향후 Triton 기반 GPU 모델 서빙을 배포할 때 사용할 예정입니다. 현재 기본 빌드/배포 파이프라인에는 포함되지 않습니다.

- 주력 오케스트레이션 서비스는 `k8s/apps/llm` 입니다 (FastAPI/LangChain/RAG).
- 로컬/프로덕션 배포 스크립트는 `llm`만 배포합니다. Triton 테스트가 필요할 때 이 디렉터리를 참조해 별도 배포를 진행하세요.
