# Gradle 빌드 프로파일 가이드

## 개요

Core 서비스는 로컬 개발 환경과 프로덕션 환경에서 서로 다른 데이터베이스 드라이버를 사용합니다:
- **로컬**: PostgreSQL 드라이버
- **프로덕션**: Oracle Database 드라이버

빌드 시 프로파일을 지정하여 필요한 드라이버만 포함하도록 설정되어 있습니다.

## 빌드 프로파일 설정

### 방법 1: 환경 변수 사용

```bash
# 로컬 빌드
export BUILD_PROFILE=local
./gradlew bootJar

# 프로덕션 빌드
export BUILD_PROFILE=prod
./gradlew bootJar
```

### 방법 2: Gradle 프로퍼티 사용

```bash
# 로컬 빌드
./gradlew bootJar -PbuildProfile=local

# 프로덕션 빌드
./gradlew bootJar -PbuildProfile=prod
```

### 방법 3: Docker 빌드 (권장)

빌드 스크립트를 사용하면 자동으로 프로파일이 설정됩니다:

```bash
# 로컬 빌드 (PostgreSQL 포함)
./scripts/build-images.sh --local

# 프로덕션 빌드 (Oracle 포함)
./scripts/build-images.sh --prod [REGISTRY] [TAG]
```

Dockerfile에서 직접 빌드하는 경우:

```bash
# 로컬 빌드
docker build --build-arg BUILD_PROFILE=local -t core:latest ./services/core

# 프로덕션 빌드
docker build --build-arg BUILD_PROFILE=prod -t core:latest ./services/core
```

## 기본값

프로파일을 지정하지 않으면 기본값은 `local`입니다.

## 구현 세부사항

### build.gradle

```gradle
// 프로파일별 데이터베이스 드라이버
def buildProfile = project.findProperty('buildProfile') ?: System.getenv('BUILD_PROFILE') ?: 'local'

if (buildProfile == 'prod') {
    // 프로덕션용 (Oracle Database)
    runtimeOnly 'com.oracle.database.jdbc:ojdbc8'
} else {
    // 로컬 개발용 (PostgreSQL)
    runtimeOnly 'org.postgresql:postgresql'
}
```

### Dockerfile

```dockerfile
# 빌드 프로파일 설정 (기본값: local)
ARG BUILD_PROFILE=local
ENV BUILD_PROFILE=${BUILD_PROFILE}

# 빌드 시 프로파일 전달
RUN gradle bootJar -x test --no-daemon -PbuildProfile=${BUILD_PROFILE}
```

## 장점

1. **이미지 크기 최적화**: 불필요한 드라이버를 제외하여 이미지 크기 감소
2. **명확한 의존성 관리**: 환경별로 필요한 의존성만 포함
3. **빌드 시간 단축**: 불필요한 의존성 다운로드 제거

## 주의사항

- 로컬 개발 시에는 항상 `local` 프로파일을 사용하세요
- 프로덕션 배포 시에는 반드시 `prod` 프로파일을 사용하세요
- 프로파일을 지정하지 않으면 기본값(`local`)이 사용됩니다

