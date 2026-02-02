# Buf 가이드

Buf는 Protocol Buffer 관리, 검증, 코드 생성을 위한 현대적인 도구입니다. 이 프로젝트에서는 Buf를 사용하여 proto 파일을 일관되게 관리하고 여러 언어(Java, TypeScript, Python)로 코드를 자동 생성합니다.

---

## 설치

### macOS

```bash
brew tap bufbuild/buf
brew install buf
```

### Linux

```bash
apt-get install buf
```

### 버전 확인

```bash
buf --version
```

---

## 프로젝트 설정 파일

### `services/proto/buf.yaml`

모듈, lint, breaking 변경 규칙을 정의합니다.

```yaml
version: v2
modules:
  - path: .
    name: buf.build/ai-interview/proto
lint:
  use:
    - STANDARD
  except:
    # 디렉토리 구조 관련 (단일 proto 폴더에 여러 패키지 사용)
    - PACKAGE_DIRECTORY_MATCH
    - PACKAGE_SAME_DIRECTORY
    - DIRECTORY_SAME_PACKAGE
    - PACKAGE_VERSION_SUFFIX
    # 기존 네이밍 호환성 유지
    - FIELD_LOWER_SNAKE_CASE
    - RPC_REQUEST_STANDARD_NAME
    - RPC_RESPONSE_STANDARD_NAME
    - SERVICE_SUFFIX
    - ENUM_VALUE_PREFIX
breaking:
  use:
    - FILE
```

**주요 규칙:**

- `STANDARD`: Buf 표준 규칙 사용
- `except`: 기존 네이밍 호환성을 위해 엄격한 규칙 제외
- `breaking`: proto 파일 변경이 호환성을 깨뜨리지 않는지 확인

### `services/proto/buf.gen.yaml`

코드 생성 플러그인과 출력 경로를 정의합니다.

```yaml
version: v2
managed:
  enabled: true
  override:
    - file_option: java_package_prefix
      value: me.unbrdn.core.grpc
    - file_option: java_multiple_files
      value: true
plugins:
  # Java (Core Service)
  - remote: buf.build/protocolbuffers/java
    out: ../core/src/main/java
  - remote: buf.build/grpc/java
    out: ../core/src/main/java

  # TypeScript (BFF & Socket Services)
  - remote: buf.build/community/timostamm-protobuf-ts
    out: ../bff/src/generated
    opt:
      - long_type_string
      - generate_dependencies
  - remote: buf.build/community/timostamm-protobuf-ts
    out: ../socket/src/generated
    opt:
      - long_type_string
      - generate_dependencies

  # Python (LLM Service)
  - remote: buf.build/protocolbuffers/python
    out: ../llm/generated
  - remote: buf.build/grpc/python
    out: ../llm/generated
```

**주요 설정:**

- `managed: true`: 생성된 파일 자동 관리
- `remote`: Buf Schema Registry 원격 플러그인 사용
- `out`: 생성된 코드 출력 경로 (상대 경로)
- `opt`: 플러그인별 옵션

---

## 주요 명령어

### 1. Lint 검사

```bash
cd services/proto && buf lint
```

Proto 파일의 네이밍, 구조, 스타일 규칙을 검증합니다.

**출력 예:**

```
auth.proto:5:1:FIELD_LOWER_SNAKE_CASE: field name "userId" should be lower_snake_case
```

### 2. 빌드 검증

```bash
buf build
```

Proto 파일이 유효한지 컴파일 테스트를 진행합니다.

### 3. Breaking 변경 확인

```bash
buf breaking --against '.git#branch=main'
```

현재 branch의 proto 파일이 main branch와의 호환성을 깨뜨리는지 확인합니다.

### 4. 코드 생성

```bash
buf generate
```

`buf.gen.yaml`에 정의된 플러그인과 출력 경로에 따라 코드를 생성합니다.

**생성 위치:**

- Java: `services/core/src/main/java`
- TypeScript (BFF): `services/bff/src/generated`
- TypeScript (Socket): `services/socket/src/generated`
- Python: `services/llm/generated`

---

## 스크립트 사용

### 자동 생성 스크립트

```bash
./scripts/buf-generate.sh
```

이 스크립트는 다음을 순차적으로 실행합니다:

1. Lint 검사
2. 빌드 검증
3. 코드 생성

---

## 플러그인 방식: Remote vs Local

### Remote 플러그인 (현재 설정)

```yaml
plugins:
  - remote: buf.build/protocolbuffers/java
    out: ../core/src/main/java
```

**장점:**

- 로컬에 `protoc`, `protoc-gen-*` 설치 불필요
- Buf가 자동으로 필요한 플러그인 다운로드 및 관리

**단점:**

- 첫 실행 시 인터넷 연결 필수
- Buf 계정/인증 필요할 수 있음

### Local 플러그인 (대안)

```yaml
plugins:
  - local: protoc-gen-java
    out: ../core/src/main/java
```

**장점:**

- 오프라인 사용 가능
- 버전 직접 관리

**단점:**

- `protoc`, `protoc-gen-grpc-java`, `protoc-gen-ts` 등 수동 설치
- 개발 환경 복잡도 증가

---

## Proto 파일 관리 규칙

### 디렉토리 구조

```
services/proto/
├── buf.yaml              # 모듈 설정
├── buf.gen.yaml          # 코드 생성 설정
├── auth.proto            # 인증 관련
├── interview.proto       # 면접 관련
├── llm.proto             # LLM 서비스
├── stt.proto             # STT 서비스
├── inference.proto       # 추론 서비스
└── resume.proto          # 이력서 서비스
```

### 패키지 정의

각 proto 파일은 고유한 패키지를 가집니다:

```proto
syntax = "proto3";
package auth;  // 또는 interview, llm, stt 등

option java_package = "me.unbrdn.core.grpc";
option java_outer_classname = "AuthProto";
```

### 네이밍 규칙 (현재 예외 허용)

- **메시지**: PascalCase (예: `SignupRequest`)
- **필드**: snake_case (예: `user_id`)
- **Enum 값**: UPPER_SNAKE_CASE (예: `INTERVIEW_TYPE_UNSPECIFIED`)
- **서비스**: `Service` suffix (예: `AuthService`)

> 현재 프로젝트에서는 기존 네이밍을 유지하기 위해 일부 Buf 규칙을 `buf.yaml`의 `except`에서 제외했습니다.

---

## Workflow: Proto 파일 수정

1. **Proto 파일 변경**

   ```bash
   # 예: services/proto/auth.proto 수정
   ```

2. **Lint 검사**

   ```bash
   cd services/proto && buf lint
   ```

3. **Breaking 변경 확인** (선택)

   ```bash
   buf breaking --against '.git#branch=main'
   ```

4. **코드 생성**

   ```bash
   buf generate
   ```

5. **Git에 추가**
   ```bash
   git add services/proto/*.proto
   git add services/{core,bff,socket,llm}/src/generated/
   git commit -m "chore: update proto definitions"
   ```

---

## 트러블슈팅

### 1. "remote plugin not found" 오류

```
Error: failed to pull image buf.build/protocolbuffers/java: ...
```

**해결:**

- 인터넷 연결 확인
- Buf Schema Registry 접속 가능 여부 확인
- 플러그인명 정확성 확인

### 2. 코드 생성 경로 오류

```
Error: failed to write generated files: permission denied
```

**해결:**

- 출력 디렉토리 권한 확인
- 디렉토리가 존재하는지 확인 (없으면 Buf가 생성)
- `buf.gen.yaml`의 `out` 경로 정확성 확인

### 3. Lint 규칙 충돌

```
FIELD_LOWER_SNAKE_CASE: field name "userId" should be lower_snake_case
```

**해결:**

- `buf.yaml`의 `except`에 규칙 추가
- 또는 필드명을 `user_id`로 변경

---

## 참고 자료

- [Buf 공식 문서](https://docs.buf.build)
- [Proto 3 언어 가이드](https://developers.google.com/protocol-buffers/docs/proto3)
- [gRPC 가이드](https://grpc.io/docs)

---

## 업데이트 로그

| 날짜       | 내용                         |
| ---------- | ---------------------------- |
| 2026-01-16 | Buf 초기 세팅 및 가이드 작성 |
