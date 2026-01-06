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

# 의존성 다운로드 (소스 코드 변경 없이도 캐시 활용)
RUN gradle dependencies --no-daemon || true

# 소스 코드 복사 (proto 파일 포함)
COPY src ./src

# Gradle을 사용하여 실행 가능한 JAR 파일 빌드 (테스트 제외, 데몬 모드 비활성화)
# 빌드 프로파일에 따라 적절한 의존성만 포함됨
RUN gradle bootJar -x test --no-daemon -PbuildProfile=${BUILD_PROFILE} && \
    find /app/build/libs -name "*.jar" -not -name "*-plain.jar" -exec cp {} /app/app.jar \;

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

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8081/actuator/health || exit 1

# 실행 명령어
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]