#!/bin/bash
# Proto 파일 컴파일 스크립트
# 중앙 Proto 저장소(services/proto)를 참조하여 각 서비스의 Proto 파일 컴파일
# 사용법: ./scripts/compile-proto.sh [--typescript]

set -e

GENERATE_TYPESCRIPT=false

# 옵션 파싱
if [ "$1" == "--typescript" ] || [ "$1" == "-t" ]; then
    GENERATE_TYPESCRIPT=true
fi

echo "🔧 Compiling proto files from services/proto..."
echo ""

# 프로젝트 루트로 이동
cd "$(dirname "$0")/.."

# LLM Service
echo "📦 LLM Service..."
cd services/llm
python -m grpc_tools.protoc \
  -I../proto \
  --python_out=. \
  --grpc_python_out=. \
  $(find ../proto -name "*.proto")
echo "✅ LLM proto compiled"
cd ../..

# STT
echo "📦 STT..."
cd services/stt
python -m grpc_tools.protoc \
  -I../proto \
  --python_out=. \
  --grpc_python_out=. \
  $(find ../proto -name "*.proto")
echo "✅ STT proto compiled"
cd ../..

# Core Service (Java - Gradle이 자동 처리)
echo "📦 Core Service (Java)..."
cd services/core
# Gradle sourceSets should handle the recursive directory
./gradlew generateProto --quiet
echo "✅ Core proto compiled"
cd ../..

# BFF Service (Node.js - 런타임 자동 로드)
echo "📦 BFF Service"

# Socket Service (Node.js - 런타임 자동 로드)
echo "📦 Socket Service"

# TypeScript 타입 생성 (옵션)
if [ "$GENERATE_TYPESCRIPT" = true ]; then
    echo ""
    echo "📦 TypeScript gRPC 타입 생성 중 (Buf Generate)..."
    cd services/proto
    buf generate
    cd ../..
    echo "✅ TypeScript gRPC 타입 생성 및 복사 완료"
fi

echo ""
echo "✅ All proto files compiled successfully!"
echo ""
echo "📁 Proto Directory Structure:"
find services/proto -name "*.proto" | sort | sed 's|services/proto/||'
echo ""
echo "💡 TypeScript 타입 생성: ./scripts/compile-proto.sh --typescript"
