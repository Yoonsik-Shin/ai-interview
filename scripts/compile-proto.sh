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
  ../proto/llm.proto
echo "✅ LLM proto compiled (llm_pb2.py, llm_pb2_grpc.py)"
cd ../..

# STT
echo "📦 STT..."
cd services/stt
python -m grpc_tools.protoc \
  -I../proto \
  --python_out=. \
  --grpc_python_out=. \
  ../proto/stt.proto
echo "✅ STT proto compiled (stt_pb2.py, stt_pb2_grpc.py)"
cd ../..

# Core Service (Java - Gradle이 자동 처리)
echo "📦 Core Service (Java)..."
cd services/core
./gradlew generateProto --quiet
echo "✅ Core proto compiled (build/generated/source/proto/main/java/)"
cd ../..

# BFF Service (Node.js - 런타임 자동 로드)
echo "📦 BFF Service (@grpc/proto-loader - runtime loaded)"

# Socket Service (Node.js - 런타임 자동 로드)
echo "📦 Socket Service (@grpc/proto-loader - runtime loaded)"

# TypeScript 타입 생성 (옵션)
if [ "$GENERATE_TYPESCRIPT" = true ]; then
    echo ""
    echo "📦 TypeScript gRPC 타입 생성 중..."
    PROTO_DIR="services/proto"
    OUT_DIR="services/proto/generated/ts"
    
    # 기존 생성 파일 정리
    rm -rf "$OUT_DIR"
    mkdir -p "$OUT_DIR"
    
    if command -v protoc &> /dev/null && command -v protoc-gen-ts_proto &> /dev/null; then
        protoc \
          --plugin=protoc-gen-ts_proto=$(which protoc-gen-ts_proto) \
          --ts_proto_out="$OUT_DIR" \
          --ts_proto_opt=outputServices=grpc-js \
          --ts_proto_opt=nestJs=true \
          --ts_proto_opt=useOptionals=none \
          -I "$PROTO_DIR" "$PROTO_DIR"/*.proto
        echo "✅ TypeScript gRPC 타입 생성 완료: $OUT_DIR"

        # 생성된 파일을 각 서비스로 복사
        echo ""
        echo "📦 각 서비스로 타입 정의 복사 중..."
        
        # Socket Service
        SOCKET_DEST="services/socket/src/types/grpc"
        mkdir -p "$SOCKET_DEST"
        cp -r "$OUT_DIR"/* "$SOCKET_DEST/"
        echo "   -> Socket Service ($SOCKET_DEST)"

        # BFF Service
        BFF_DEST="services/bff/src/types/grpc"
        mkdir -p "$BFF_DEST"
        cp -r "$OUT_DIR"/* "$BFF_DEST/"
        echo "   -> BFF Service ($BFF_DEST)"
    else
        echo "⚠️  protoc 또는 protoc-gen-ts_proto가 설치되지 않았습니다."
        echo "   설치 방법: brew install protobuf && npm install -g ts-proto"
    fi
fi

echo ""
echo "✅ All proto files compiled successfully!"
echo ""
echo "📁 Central Proto Location: services/proto/"
find services/proto -maxdepth 1 -type f -name "*.proto" -print | sort | sed 's|.*/|- |'
echo ""
echo "💡 TypeScript 타입 생성: ./scripts/compile-proto.sh --typescript"
