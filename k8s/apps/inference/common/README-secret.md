# Inference(Triton) Secret 안내

## 주의사항

Inference(Triton) 구성은 **OpenAI API 키가 필요하지 않습니다**. 일반적으로 Secret 생성은 불필요합니다.

## 필요 시 (옵션) Secret 사용

다른 외부 시스템 연동 등 특수한 목적이 있다면 별도의 Secret을 생성해 사용할 수 있습니다. 이 경우 **namespace를 inference로 설정**하세요.
