# ------------------------------------
# 0단계: Proto 생성 (Proto Gen Stage)
# ------------------------------------
FROM bufbuild/buf:latest AS proto-gen
WORKDIR /workspace
# --build-context proto=services/proto 로 주입된 컨텍스트를 사용
COPY --from=proto . ./proto
# buf.gen.yaml의 상대 경로(../socket/src/generated 등)를 위한 디렉토리 생성
RUN mkdir -p gateways/bff/src/types/grpc && \
    mkdir -p gateways/socket/src/types/grpc && \
    mkdir -p core/src/main/java && \
    mkdir -p infra/llm/generated
WORKDIR /workspace/proto
RUN buf generate


# ------------------------------------
# 1단계: 빌드 (Builder Stage)
# ------------------------------------
FROM node:22-alpine AS builder


RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /workspace

# proto (generated TS) — ../proto/generated/ts
COPY --from=proto-gen /workspace/gateways/socket/src/types/grpc /workspace/proto/generated/ts


# socket: 의존성 먼저 (레이어 캐싱)
COPY package.json pnpm-lock.yaml ./socket/
WORKDIR /workspace/socket
RUN pnpm install --frozen-lockfile

# socket: 소스 전체
COPY . .
# 캐시 무효화를 위한 환경 변수 (필요시 값 변경)
ENV CACHE_BUST=1


RUN pnpm run build

# ------------------------------------
# 2단계: 실행 (Runner Stage)
# ------------------------------------
FROM node:22-alpine AS runner

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app/socket

COPY --chown=nestjs:nodejs package.json pnpm-lock.yaml ./
RUN pnpm install --prod --no-frozen-lockfile && \
    pnpm store prune

COPY --chown=nestjs:nodejs --from=builder /workspace/socket/dist ./dist
COPY --chown=nestjs:nodejs --from=proto-gen /workspace/proto /app/proto


USER nestjs
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=5 \
  CMD node -e "require('http').get('http://localhost:4000/health/liveness', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

CMD ["pnpm", "run", "start:prod"]
