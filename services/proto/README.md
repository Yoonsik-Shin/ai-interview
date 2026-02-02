# Proto 파일 관리 가이드

## 📁 구조

모든 Proto 파일은 `services/proto/` 에서 중앙 관리됩니다.

```
services/
├── proto/                    # 중앙 Proto 저장소
│   ├── auth.proto
│   ├── interview.proto
│   ├── resume.proto
│   ├── llm.proto
│   ├── stt.proto
│   └── inference.proto
│
├── llm/                      # Python 서비스
│   ├── Makefile              # Proto 컴파일 자동화
│   └── llm_pb2.py (생성됨)
│
└── stt/              # Python 서비스
    ├── Makefile
    └── stt_pb2.py (생성됨)
```

---

## 🔧 Proto 컴파일 방법

### 1️⃣ **전체 서비스 일괄 컴파일 (권장)**

프로젝트 루트에서 스크립트 실행:

```bash
# 프로젝트 루트에서
./scripts/compile-proto.sh

# 실행 내용:
# - LLM: llm_pb2.py, llm_pb2_grpc.py 생성
# - STT: stt_pb2.py, stt_pb2_grpc.py 생성
# - Core: Gradle이 자동 컴파일
# - BFF/Socket: 런타임 자동 로드 (컴파일 불필요)
```

### 2️⃣ **개별 서비스 컴파일 (Makefile 사용)**

```bash
# LLM 서비스
cd services/llm
make proto        # Proto 컴파일만
make run          # Proto 컴파일 + 서버 실행
make dev          # Proto 컴파일 + Supervisor (FastAPI+gRPC+Kafka)
make clean        # 생성된 파일 삭제
make help         # 명령어 도움말

# STT
cd services/stt
make proto        # Proto 컴파일만
make run          # Proto 컴파일 + STT gRPC 서버 실행
make dev          # Proto 컴파일 + 모든 워커 실행
make clean
make help
```

**Makefile이란?**

- Unix/Linux 빌드 자동화 도구
- 긴 명령어를 짧게 축약 (`make proto` vs `python -m grpc_tools.protoc ...`)
- 의존성 자동 관리 (proto 먼저 컴파일 후 실행)

### 3️⃣ **Docker 빌드 (자동 컴파일)**

Dockerfile이 자동으로 Proto를 컴파일합니다.

```bash
# LLM 서비스
cd services/llm
docker build -t llm:latest .

# STT
cd services/stt
docker build -t stt:latest .
```

### 4️⃣ **수동 컴파일 (직접 실행)**

```bash
# LLM
cd services/llm
python -m grpc_tools.protoc \
  -I../proto \
  --python_out=. \
  --grpc_python_out=. \
  ../proto/llm.proto

# STT
cd services/stt
python -m grpc_tools.protoc \
  -I../proto \
  --python_out=. \
  --grpc_python_out=. \
  ../proto/stt.proto
```

---

## 📝 Proto 파일 수정 시 워크플로우

1. **Proto 파일 수정**

   ```bash
   vim services/proto/llm.proto
   ```

2. **모든 서비스 재컴파일**

   ```bash
   # Java (Core)
   cd services/core && ./gradlew clean build

   # Node.js (BFF/Socket) - 런타임 로드이므로 재시작만
   cd services/bff && npm run start:dev

   # Python (LLM)
   cd services/llm && make proto

# Python (STT)
cd services/stt && make proto
   ```

3. **서비스 재시작**
   - 로컬: 각 서비스 재시작
   - Docker: 이미지 리빌드

---

## ⚠️ 주의사항

### Python 서비스

- ✅ **반드시 Proto 컴파일 후 실행**

  ```bash
  make proto  # 또는 make run
  ```

- ❌ **컴파일 없이 실행하면 ImportError**
  ```python
  ImportError: cannot import name 'llm_pb2'
  ```

### Java 서비스 (Core)

- ✅ Gradle이 자동 컴파일 (`./gradlew build`)
- 생성 위치: `build/generated/source/proto/main/java/`

### Node.js 서비스 (BFF/Socket)

- ✅ 런타임에 자동 로드 (컴파일 불필요)
- `@grpc/proto-loader`가 Proto 파일 직접 읽음

---

## 🚀 빠른 시작

```bash
# LLM 서비스 (로컬)
cd services/llm
make run

# STT (로컬)
cd services/stt
make run

# Docker Compose (전체)
docker-compose up
```

---

## 📚 참고

- [gRPC Python Tutorial](https://grpc.io/docs/languages/python/quickstart/)
- [Coding Convention](../../docs/coding_convention.md)
- [Proto 관리 가이드](../../docs/coding_convention.md#12-proto-file-management-guide)
