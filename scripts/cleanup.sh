#!/bin/bash

# 클러스터 정리 스크립트 (통합)
# 사용법: 
#   ./scripts/cleanup.sh                    # 실패한 Pod만 정리
#   ./scripts/cleanup.sh --all              # 실패한 Pod + 디스크 정리
#   ./scripts/cleanup.sh [NAMESPACE]        # 특정 네임스페이스만 정리
#   ./scripts/cleanup.sh --all [NAMESPACE]  # 특정 네임스페이스 전체 정리

set -e

CLEANUP_ALL=false
NAMESPACES=()

# 옵션 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        --all|-a)
            CLEANUP_ALL=true
            shift
            ;;
        *)
            NAMESPACES+=("$1")
            shift
            ;;
    esac
done

# 네임스페이스가 지정되지 않으면 기본값 사용
if [ ${#NAMESPACES[@]} -eq 0 ]; then
    NAMESPACES=("unbrdn" "kafka")
    echo "🧹 모든 네임스페이스의 정리를 시작합니다..."
    echo "   대상: unbrdn, kafka"
else
    echo "🧹 네임스페이스 '${NAMESPACES[*]}'의 정리를 시작합니다..."
fi
echo ""

# kubectl 설치 확인
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl이 설치되어 있지 않습니다."
    exit 1
fi

# =============================================================================
# 1. 실패한 Pod 정리
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 실패한 Pod 정리"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TOTAL_DELETED=0

for NAMESPACE in "${NAMESPACES[@]}"; do
    echo "📦 네임스페이스: ${NAMESPACE}"
    
    # 네임스페이스 존재 확인
    if ! kubectl get namespace ${NAMESPACE} &> /dev/null; then
        echo "⚠️  네임스페이스 '${NAMESPACE}'를 찾을 수 없습니다. 건너뜁니다."
        echo ""
        continue
    fi
    
    # 현재 Pod 상태 요약
    echo "📊 현재 Pod 상태:"
    kubectl get pods -n ${NAMESPACE} --no-headers 2>/dev/null | awk '{print $3}' | sort | uniq -c || echo "   Pod 없음"
    echo ""
    
    # 실패한 Pod 개수 확인
    FAILED_COUNT=$(kubectl get pods -n ${NAMESPACE} --field-selector=status.phase=Failed 2>/dev/null | grep -v "NAME" | wc -l | tr -d ' ')
    UNKNOWN_COUNT=$(kubectl get pods -n ${NAMESPACE} --field-selector=status.phase=Unknown 2>/dev/null | grep -v "NAME" | wc -l | tr -d ' ')
    SUCCEEDED_COUNT=$(kubectl get pods -n ${NAMESPACE} --field-selector=status.phase=Succeeded 2>/dev/null | grep -v "NAME" | wc -l | tr -d ' ')
    EVICTED_COUNT=$(kubectl get pods -n ${NAMESPACE} 2>/dev/null | grep "Evicted" | wc -l | tr -d ' ')
    CONTAINER_UNKNOWN_COUNT=$(kubectl get pods -n ${NAMESPACE} 2>/dev/null | grep "ContainerStatusUnknown" | wc -l | tr -d ' ')
    
    TOTAL_TO_DELETE=$((FAILED_COUNT + UNKNOWN_COUNT + SUCCEEDED_COUNT + EVICTED_COUNT + CONTAINER_UNKNOWN_COUNT))
    
    if [ "$TOTAL_TO_DELETE" -eq 0 ]; then
        echo "✅ 정리할 실패한 Pod가 없습니다."
        echo ""
        continue
    fi
    
    echo "정리 대상 Pod:"
    echo "   - Failed: ${FAILED_COUNT}개"
    echo "   - Unknown: ${UNKNOWN_COUNT}개"
    echo "   - Succeeded/Completed: ${SUCCEEDED_COUNT}개"
    echo "   - Evicted: ${EVICTED_COUNT}개"
    echo "   - ContainerStatusUnknown: ${CONTAINER_UNKNOWN_COUNT}개"
    echo ""
    
    # 첫 번째 네임스페이스에서만 확인 요청
    if [ "$NAMESPACE" == "${NAMESPACES[0]}" ]; then
        read -p "계속 진행하시겠습니까? (Y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Nn]$ ]]; then
            echo "❌ 취소되었습니다."
            exit 0
        fi
        echo ""
    fi
    
    echo "🗑️  Pod 삭제 중..."
    
    # Failed 상태 Pod 삭제
    if [ "$FAILED_COUNT" -gt 0 ]; then
        echo "   - Failed Pod 삭제 중..."
        kubectl delete pods -n ${NAMESPACE} --field-selector=status.phase=Failed --grace-period=0 --force 2>/dev/null || true
    fi
    
    # Unknown 상태 Pod 삭제
    if [ "$UNKNOWN_COUNT" -gt 0 ]; then
        echo "   - Unknown Pod 삭제 중..."
        kubectl delete pods -n ${NAMESPACE} --field-selector=status.phase=Unknown --grace-period=0 --force 2>/dev/null || true
    fi
    
    # Succeeded 상태 Pod 삭제
    if [ "$SUCCEEDED_COUNT" -gt 0 ]; then
        echo "   - Completed Pod 삭제 중..."
        kubectl delete pods -n ${NAMESPACE} --field-selector=status.phase=Succeeded --grace-period=0 --force 2>/dev/null || true
    fi
    
    # Evicted Pod 삭제
    if [ "$EVICTED_COUNT" -gt 0 ]; then
        echo "   - Evicted Pod 삭제 중..."
        kubectl get pods -n ${NAMESPACE} 2>/dev/null | grep "Evicted" | awk '{print $1}' | xargs -r kubectl delete pod -n ${NAMESPACE} --grace-period=0 --force 2>/dev/null || true
    fi
    
    # ContainerStatusUnknown Pod 삭제
    if [ "$CONTAINER_UNKNOWN_COUNT" -gt 0 ]; then
        echo "   - ContainerStatusUnknown Pod 삭제 중..."
        kubectl get pods -n ${NAMESPACE} 2>/dev/null | grep "ContainerStatusUnknown" | awk '{print $1}' | xargs -r kubectl delete pod -n ${NAMESPACE} --grace-period=0 --force 2>/dev/null || true
    fi
    
    echo ""
    echo "✅ '${NAMESPACE}' 네임스페이스 정리 완료!"
    echo ""
    echo "📊 정리 후 Pod 상태:"
    kubectl get pods -n ${NAMESPACE} --no-headers 2>/dev/null | awk '{print $3}' | sort | uniq -c || echo "   Pod 없음"
    echo ""
    
    TOTAL_DELETED=$((TOTAL_DELETED + TOTAL_TO_DELETE))
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Pod 정리 완료! (총 ${TOTAL_DELETED}개 삭제)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# =============================================================================
# 2. 디스크 정리 (--all 옵션일 때만)
# =============================================================================
if [ "$CLEANUP_ALL" = true ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "💾 디스크 공간 정리"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # 1. Docker 정리
    echo "📦 Docker 리소스 정리 중..."
    docker system prune -f --volumes 2>/dev/null || echo "⚠️  Docker 정리 실패 (Docker가 실행 중이 아닐 수 있음)"
    echo ""
    
    # 2. Kind 클러스터 내부 정리
    if command -v kind &> /dev/null; then
        echo "🗑️  Kind 클러스터 임시 저장소 정리 중..."
        for node in $(kind get nodes --name unbrdn 2>/dev/null || true); do
            echo "  노드 정리 중: $node"
            docker exec "$node" sh -c '
                # 임시 파일 정리
                find /tmp -type f -atime +7 -delete 2>/dev/null || true
                
                # 로그 파일 정리 (7일 이상)
                find /var/log -type f -name "*.log" -mtime +7 -delete 2>/dev/null || true
                
                # containerd 이미지 정리
                crictl rmi --prune 2>/dev/null || true
            ' 2>/dev/null || echo "    ⚠️  노드 정리 실패"
        done
        echo ""
        
        # 3. 디스크 사용량 확인
        echo "📊 정리 후 디스크 사용량:"
        for node in $(kind get nodes --name unbrdn 2>/dev/null || true); do
            echo "Node: $node"
            docker exec "$node" df -h / | tail -1 2>/dev/null || echo "  사용량 확인 실패"
        done
        echo ""
    else
        echo "⚠️  Kind가 설치되지 않았습니다. Kind 클러스터 정리를 건너뜁니다."
        echo ""
    fi
    
    echo "✅ 디스크 정리 완료!"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 전체 정리 완료!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 사용법:"
echo "   - 실패한 Pod만 정리: ./scripts/cleanup.sh"
echo "   - 전체 정리 (Pod + 디스크): ./scripts/cleanup.sh --all"
echo "   - 특정 네임스페이스: ./scripts/cleanup.sh unbrdn"
echo ""
