#!/bin/bash

# Docker 이미지 크기 확인 스크립트
# 사용법: ./scripts/check-image-sizes.sh

set -e

echo "📊 Docker 이미지 크기 보고서"
echo "================================"
echo ""

SERVICES=("bff" "core" "llm" "socket")
TOTAL_SIZE=0

for service in "${SERVICES[@]}"; do
    IMAGE_NAME="unbrdn-${service}:latest"
    
    if docker image inspect "$IMAGE_NAME" &>/dev/null; then
        # 바이트 단위로 크기 가져오기
        SIZE_BYTES=$(docker image inspect "$IMAGE_NAME" --format='{{.Size}}' 2>/dev/null)
        # 사람이 읽기 쉬운 형식으로 변환
        SIZE_HUMAN=$(echo "$SIZE_BYTES" | numfmt --to=iec 2>/dev/null || echo "N/A")
        
        echo "✅ ${service}: ${SIZE_HUMAN}"
        TOTAL_SIZE=$((TOTAL_SIZE + SIZE_BYTES))
    else
        echo "❌ ${service}: 이미지를 찾을 수 없음"
    fi
done

echo ""
echo "================================"
if [ $TOTAL_SIZE -gt 0 ]; then
    TOTAL_HUMAN=$(echo "$TOTAL_SIZE" | numfmt --to=iec)
    echo "총 크기: ${TOTAL_HUMAN}"
else
    echo "총 크기: 계산 불가"
fi
echo "================================"
echo ""

# 상세 정보 (선택적)
if [ "$1" = "--detailed" ] || [ "$1" = "-d" ]; then
    echo ""
    echo "📋 상세 정보"
    echo "================================"
    docker images --filter "reference=unbrdn-*" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    echo ""
fi

# 레이어 분석 (선택적)
if [ "$1" = "--layers" ] || [ "$1" = "-l" ]; then
    echo ""
    echo "🔍 레이어 분석"
    echo "================================"
    for service in "${SERVICES[@]}"; do
        IMAGE_NAME="unbrdn-${service}:latest"
        if docker image inspect "$IMAGE_NAME" &>/dev/null; then
            echo ""
            echo "📦 ${service} 레이어:"
            docker history "$IMAGE_NAME" --human --format "table {{.Size}}\t{{.CreatedBy}}" | head -20
        fi
    done
    echo ""
fi

echo ""
echo "💡 팁:"
echo "  - 상세 정보 보기: $0 --detailed"
echo "  - 레이어 분석: $0 --layers"
echo ""
