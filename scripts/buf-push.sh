#!/bin/bash
# Buf Schema Registry에 Proto 파일 푸시 스크립트

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROTO_DIR="$SCRIPT_DIR/../services/proto"

cd "$PROTO_DIR"

echo "🔍 Proto 파일 lint 검사 중..."
buf lint

echo "🔨 Proto 파일 빌드 검증 중..."
buf build

echo "📤 Buf Schema Registry에 푸시 중..."
buf push

echo "✅ 완료!"
echo ""
echo "푸시된 모듈: buf.build/unbrdn-org/unbrdn-repo"
