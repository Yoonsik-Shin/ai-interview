# Build and Deploy Script Updates

## 변경사항

`build-images-local.sh` 스크립트가 빌드한 서비스만 배포하도록 개선되었습니다.

## 사용 방법

### 1. 특정 서비스만 빌드 및 배포

```bash
# Core 서비스만 빌드
./scripts/build-images-local.sh core

# 빌드 완료 후 메뉴에서 "2. 로컬 배포" 선택
# → Core 서비스만 배포됩니다
```

```bash
# BFF와 Socket 서비스만 빌드
./scripts/build-images-local.sh bff socket

# 빌드 완료 후 메뉴에서 "2. 로컬 배포" 선택
# → BFF와 Socket 서비스만 배포됩니다
```

### 2. 모든 서비스 빌드 및 배포

```bash
# 인자 없이 실행 (모든 서비스 빌드)
./scripts/build-images-local.sh

# 빌드 완료 후 메뉴에서 "2. 로컬 배포" 선택
# → 모든 서비스가 배포됩니다
```

## 동작 방식

1. **빌드 단계**: 사용자가 지정한 서비스만 빌드
2. **배포 선택**: 빌드 완료 후 인터랙티브 메뉴 표시
3. **배포 단계**:
   - 특정 서비스를 빌드한 경우 → 해당 서비스만 배포
   - 모든 서비스를 빌드한 경우 → 모든 서비스 배포

## 예시 시나리오

### Core 서비스 수정 후 배포

```bash
# 1. Core 서비스만 빌드
./scripts/build-images-local.sh core

# 2. 빌드 완료 후 표시되는 메뉴
# 💡 다음 동작을 선택하세요 (30초 후 자동 종료):
#   0. 종료
#   1. 이미지 확인 (docker images)
#   2. 로컬 배포 (./scripts/deploy-local.sh)

# 3. "2" 입력
# 🎯 다음 서비스만 배포됩니다: core

# 4. 배포 확인
# 정말 배포하시겠습니까? (y/n): y
```

### 여러 서비스 동시 배포

```bash
# BFF, Core, Socket 서비스 빌드 및 배포
./scripts/build-images-local.sh bff core socket

# 메뉴에서 "2" 선택
# 🎯 다음 서비스만 배포됩니다: bff core socket
```

## 장점

1. **빠른 개발 사이클**: 수정한 서비스만 빌드하고 배포
2. **리소스 절약**: 불필요한 서비스 재배포 방지
3. **명확한 피드백**: 어떤 서비스가 배포될지 미리 표시
4. **기존 동작 유지**: 인자 없이 실행하면 모든 서비스 배포 (하위 호환성)
