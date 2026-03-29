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

# Helper function to compile Python protos
compile_python_protos() {
    local service=$1
    local proto_root="../../proto"
    # If service is nested (e.g. infra/llm), we need a deeper path
    if [[ $service == */* ]]; then
        proto_root="../../../services/proto"
    else
        proto_root="../../services/proto"
    fi

    echo "📦 Rendering Protos for: ${service}"
    cd "services/${service}"
    mkdir -p generated
    touch generated/__init__.py
    
    # Compile all protos into the generated directory
    python -m grpc_tools.protoc \
        -I"${proto_root}" \
        --python_out=generated \
        --grpc_python_out=generated \
        $(find "${proto_root}" -name "*.proto")
    
    # Create __init__.py in nested directories for Python package consistency
    find generated -type d -not -path 'generated' -exec touch {}/__init__.py \;
    
    echo "✅ ${service} proto compiled"
    cd - > /dev/null
}

# Python Services
compile_python_protos "infra/llm"
compile_python_protos "infra/stt"
compile_python_protos "infra/storage"
compile_python_protos "infra/document"

# Core Service (Java - Gradle이 자동 처리)
echo "📦 Core Service (Java)..."
cd services/domains
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
