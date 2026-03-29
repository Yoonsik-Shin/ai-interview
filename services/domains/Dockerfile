# syntax=docker/dockerfile:1.4
# --- Stage 1: 빌드 환경 (Gradle로 빌드) ---
FROM gradle:8.14.0-jdk21 AS builder

WORKDIR /app

# 빌드 프로파일 설정 (기본값: local)
ARG BUILD_PROFILE=local
ENV BUILD_PROFILE=${BUILD_PROFILE}

# Gradle 캐시 최적화를 위한 환경 변수 설정
ENV GRADLE_USER_HOME=/app/.gradle

# Gradle 설정 파일 먼저 복사 (레이어 캐싱 최적화)
COPY build.gradle settings.gradle gradle.properties* ./
COPY gradle ./gradle

# 중앙 proto를 /proto에 복사 (sourceSets에서 ../proto 참조)
COPY --from=proto . /proto

# 의존성 다운로드 (소스 코드 변경 없이도 캐시 활용)
# BuildKit 캐시 마운트로 Gradle 캐시 최적화
RUN --mount=type=cache,id=gradle-cache-$MODULE_NAME,target=/app/.gradle \
    gradle dependencies --no-daemon || true

# 소스 코드 복사 (proto 파일 포함)
ARG MODULE_NAME

# 공통 모듈 및 빌드 대상 모듈 복사
COPY common ./common
COPY $MODULE_NAME ./$MODULE_NAME

# Gradle을 사용하여 실행 가능한 JAR 파일 빌드 (테스트 제외, 데몬 모드 비활성화)
# 빌드 프로파일에 따라 적절한 의존성만 포함됨
# BuildKit 캐시 마운트로 빌드 캐시 재사용
RUN --mount=type=cache,id=gradle-build-$MODULE_NAME,target=/app/.gradle \
    gradle clean :$MODULE_NAME:bootJar -x test --no-daemon -PbuildProfile=${BUILD_PROFILE} && \
    find /app/$MODULE_NAME/build/libs -name "*.jar" -not -name "*-plain.jar" -exec cp {} /app/app.jar \;

# --- Stage 2: 실행 환경 (JRE만 있는 가벼운 환경) ---
FROM eclipse-temurin:21-jre-alpine

# 보안을 위한 non-root 사용자 생성
RUN addgroup -S appuser && adduser -S appuser -G appuser

WORKDIR /app

# JAR 파일 복사
COPY --chown=appuser:appuser --from=builder /app/app.jar app.jar

# non-root 사용자로 전환
USER appuser

# 포트 노출
EXPOSE 8081

# JVM 최적화 옵션 추가 (메모리 및 GC 최적화)
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:+UseG1GC"

# 헬스체크 추가 (alpine에는 curl이 기본 포함)
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8081/actuator/health 2>/dev/null || exit 1

# 실행 명령어
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
