# ------------------------------------
# 1단계: 빌드 (Builder Stage)
# ------------------------------------
# Node.js LTS 버전 사용 권장 (예: 20, 22). 24가 최신이라도 안정성을 위해 LTS를 추천합니다.
FROM node:24-alpine AS builder

# pnpm 설치 (corepack 사용)
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 의존성 파일 먼저 복사 (캐싱 효율을 위해)
COPY package.json pnpm-lock.yaml ./

# 1. 모든 의존성 설치 (빌드를 위해 devDependencies도 필요)
RUN pnpm install --frozen-lockfile

# 2. 소스 코드 전체 복사
# (.dockerignore 파일이 필수입니다! node_modules 등을 제외하기 위해)
COPY . .

# 3. NestJS 프로젝트 빌드 (dist 폴더 생성)
RUN pnpm run build

# 4. 프로덕션 의존성만 남기고 나머지 정리 (이미지 크기 감소 목적)
# 이 과정은 선택 사항이지만, builder 이미지도 가볍게 유지하려면 좋습니다.
# RUN pnpm prune --prod

# ------------------------------------
# 2단계: 실행 (Runner Stage) - 최종 이미지
# ------------------------------------
FROM node:24-alpine AS runner

# pnpm 설치
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 1. 프로덕션 실행에 필요한 파일들만 'builder' 스테이지에서 복사합니다.
# package.json과 lock 파일은 실행 시 스크립트나 버전 정보를 위해 필요할 수 있습니다.
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./

# 2. 실행에 필요한 '프로덕션 의존성(dependencies)'만 설치합니다.
RUN pnpm install --prod --frozen-lockfile

# 3. 빌드된 결과물(dist 폴더)을 복사합니다.
COPY --from=builder /app/dist ./dist

# 4. test-client.html 파일 복사 (테스트 클라이언트 제공용)
COPY --from=builder /app/test-client.html ./test-client.html

# 포트 노출 (문서화)
EXPOSE 3000

# 실행 명령어
CMD ["pnpm", "run", "start:prod"]