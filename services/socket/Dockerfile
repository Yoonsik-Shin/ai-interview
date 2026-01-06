# ------------------------------------
# 1단계: 빌드 (Builder Stage)
# ------------------------------------
FROM node:24-alpine AS builder

# pnpm 설치 및 캐시 설정
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 의존성 파일 먼저 복사 (레이어 캐싱 최적화)
COPY package.json pnpm-lock.yaml ./

# 의존성 설치 (캐시 최적화를 위해 별도 레이어)
RUN pnpm install --frozen-lockfile

# 소스 코드 전체 복사
# (.dockerignore 파일이 필수입니다! node_modules 등을 제외하기 위해)
COPY . .

# NestJS 프로젝트 빌드
RUN pnpm run build

# ------------------------------------
# 2단계: 실행 (Runner Stage) - 최종 이미지
# ------------------------------------
FROM node:24-alpine AS runner

# 보안을 위한 non-root 사용자 생성
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# pnpm 설치
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 프로덕션 의존성만 설치 (캐시 최적화)
COPY --chown=nestjs:nodejs package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile && \
    pnpm store prune

# 빌드된 결과물만 복사
COPY --chown=nestjs:nodejs --from=builder /app/dist ./dist

# non-root 사용자로 전환
USER nestjs

# 포트 노출
EXPOSE 4000

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# 실행 명령어
CMD ["pnpm", "run", "start:prod"]

