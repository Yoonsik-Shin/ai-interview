#!/bin/bash
# Buf를 사용한 Proto 파일 코드 생성 스크립트

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROTO_DIR="$SCRIPT_DIR/../services/proto"

cd "$PROTO_DIR"

echo "🔍 Proto 파일 lint 검사 중..."
buf lint

echo "🔨 Proto 파일 빌드 검증 중..."
buf build

echo "📦 코드 생성 중..."
buf generate

echo "✅ 완료!"
echo ""
echo "생성된 파일 위치:"
echo "  - Java (Core):      services/core/src/main/java"
echo "  - TypeScript (BFF): services/bff/src/generated"
echo "  - TypeScript (Socket): services/socket/src/generated"
echo "  - Python (LLM):     services/llm/generated"
