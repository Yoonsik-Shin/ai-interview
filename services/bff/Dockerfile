# ------------------------------------
# 0단계: Proto 생성 (Proto Gen Stage)
# ------------------------------------
FROM bufbuild/buf:latest AS proto-gen
WORKDIR /workspace
# --build-context proto=services/proto 로 주입된 컨텍스트를 사용
COPY --from=proto . ./proto
# buf.gen.yaml의 상대 경로(../bff/src/generated 등)를 위한 디렉토리 생성
RUN mkdir -p bff/src/generated && \
    mkdir -p socket/src/generated && \
    mkdir -p core/src/main/java && \
    mkdir -p llm/generated
WORKDIR /workspace/proto
RUN buf generate


# ------------------------------------
# 1단계: 빌드 (Builder Stage)
# ------------------------------------
# Node.js LTS 버전 사용 (22가 현재 ACTIVE LTS)
FROM node:22-alpine AS builder


# pnpm 설치 (corepack 사용)
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# gRPC 타입 생성물 복사 (tsconfig 경로: ../proto/generated/ts, proto/generated/ts)
# gRPC 타입 생성물 복사 (tsconfig 경로: proto/generated/ts)
COPY --from=proto-gen /workspace/bff/src/generated /app/proto/generated/ts



# 의존성 파일 먼저 복사 (캐싱 효율을 위해)
COPY package.json pnpm-lock.yaml ./

# 1. 모든 의존성 설치 (빌드를 위해 devDependencies도 필요)
RUN pnpm install --frozen-lockfile

# 2. 소스 코드 전체 복사
# (.dockerignore 파일이 필수입니다! node_modules 등을 제외하기 위해)
COPY . .

# 3. NestJS 프로젝트 빌드 (dist 폴더 생성)
RUN pnpm run build
RUN test -f /app/dist/src/main.js

# 4. 프로덕션 의존성만 남기고 나머지 정리 (이미지 크기 감소 목적)
# 이 과정은 선택 사항이지만, builder 이미지도 가볍게 유지하려면 좋습니다.
# RUN pnpm prune --prod

# ------------------------------------
# 2단계: 실행 (Runner Stage) - 최종 이미지
# ------------------------------------
FROM node:22-alpine AS runner

# pnpm 설치
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 1. 프로덕션 실행에 필요한 파일들만 'builder' 스테이지에서 복사합니다.
# package.json과 lock 파일은 실행 시 스크립트나 버전 정보를 위해 필요할 수 있습니다.
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./

# 2. 실행에 필요한 '프로덕션 의존성(dependencies)'만 설치합니다.
RUN pnpm install --prod --frozen-lockfile && \
    pnpm store prune

# 3. 빌드된 결과물(dist 폴더)을 복사합니다.
COPY --from=builder /app/dist ./dist

# 3.5. Proto 파일 복사 (gRPC 클라이언트용)
# 3.5. Proto 파일 복사 (gRPC 클라이언트용 - .proto 파일 자체도 필요함)
# proto-gen 단계에서 /workspace/proto에 원본이 있음
COPY --from=proto-gen /workspace/proto /app/proto



# 4. test-client.html 파일 복사 (/test-client 엔드포인트에서 제공)
COPY --from=builder /app/test-client.html ./test-client.html

# 포트 노출 (문서화)
EXPOSE 3000

# 실행 명령어
CMD ["pnpm", "run", "start:prod"]
