# ------------------------------------
# 0단계: Proto 생성 (Proto Gen Stage)
# ------------------------------------
FROM bufbuild/buf:latest AS proto-gen
WORKDIR /workspace
# --build-context proto=services/proto 로 주입된 컨텍스트를 사용
COPY --from=proto . ./proto
# BFF 서비스를 위한 디렉토리 생성
RUN mkdir -p gateways/bff/src/types/grpc
WORKDIR /workspace/proto
RUN buf generate

# ------------------------------------
# 1단계: 빌드 (Builder Stage)
# ------------------------------------
FROM node:22-alpine AS builder

# pnpm 설치
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# gRPC 생성물 복사
COPY --from=proto-gen /workspace/gateways/bff/src/types/grpc /app/proto/generated/ts

# 의존성 파일 복사 (캐싱 효율 최적화)
COPY package.json pnpm-lock.yaml ./

# 모든 의존성 설치
RUN pnpm install --frozen-lockfile

# 소스 코드 복사
COPY . .

# NestJS 프로젝트 빌드
RUN pnpm run build
RUN test -f /app/dist/src/main.js

# ------------------------------------
# 2단계: 실행 (Runner Stage) - 최종 이미지
# ------------------------------------
FROM node:22-alpine AS runner

# pnpm 설치
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 프로덕션 실행용 파일 복사
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./

# 프로덕션 의존성만 설치
RUN pnpm install --prod --frozen-lockfile && \
    pnpm store prune

# 빌드 결과물 복사
COPY --from=builder /app/dist ./dist

# gRPC 원본 Proto 파일 복사
COPY --from=proto-gen /workspace/proto /app/proto

# 포트 노출
EXPOSE 3000

# 실행 명령어
CMD ["pnpm", "run", "start:prod"]
