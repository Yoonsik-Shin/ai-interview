#!/bin/bash
# 모든 레플리카셋 및 Pod 삭제 스크립트
# 사용법: 
#   ./scripts/delete-all-replicasets.sh                    # 모든 네임스페이스
#   ./scripts/delete-all-replicasets.sh unbrdn            # 특정 네임스페이스
#   ./scripts/delete-all-replicasets.sh unbrdn kafka       # 여러 네임스페이스

set -e

NAMESPACES=()

# 네임스페이스 파라미터 파싱
if [ $# -eq 0 ]; then
    # 모든 네임스페이스에서 레플리카셋 찾기
    echo "🔍 모든 네임스페이스의 레플리카셋을 검색 중..."
    NAMESPACES=($(kubectl get namespaces -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo ""))
    if [ ${#NAMESPACES[@]} -eq 0 ]; then
        echo "❌ 네임스페이스를 찾을 수 없습니다."
        exit 1
    fi
    echo "   발견된 네임스페이스: ${NAMESPACES[*]}"
else
    NAMESPACES=("$@")
    echo "📦 대상 네임스페이스: ${NAMESPACES[*]}"
fi

echo ""

# kubectl 설치 확인
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl이 설치되어 있지 않습니다."
    exit 1
fi

# 레플리카셋 및 Pod 목록 수집
TOTAL_RS=0
TOTAL_PODS=0
RS_LIST=()
POD_LIST=()

for NAMESPACE in "${NAMESPACES[@]}"; do
    if ! kubectl get namespace "${NAMESPACE}" &> /dev/null; then
        echo "⚠️  네임스페이스 '${NAMESPACE}'가 존재하지 않습니다. 건너뜁니다."
        continue
    fi
    
    echo "🔍 네임스페이스 '${NAMESPACE}'의 레플리카셋 및 Pod 검색 중..."
    
    # 레플리카셋 수집
    RS_IN_NS=($(kubectl get replicasets -n "${NAMESPACE}" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo ""))
    
    if [ ${#RS_IN_NS[@]} -gt 0 ]; then
        echo "   발견된 레플리카셋 (${#RS_IN_NS[@]}개):"
        for rs in "${RS_IN_NS[@]}"; do
            replicas=$(kubectl get replicaset "${rs}" -n "${NAMESPACE}" -o jsonpath='{.status.replicas}' 2>/dev/null || echo "0")
            ready=$(kubectl get replicaset "${rs}" -n "${NAMESPACE}" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
            echo "   - ${rs} (replicas: ${replicas}, ready: ${ready})"
            RS_LIST+=("${NAMESPACE}/${rs}")
            TOTAL_RS=$((TOTAL_RS + 1))
        done
    else
        echo "   레플리카셋 없음"
    fi
    
    # Pod 수집 (레플리카셋이 관리하는 Pod만)
    PODS_IN_NS=($(kubectl get pods -n "${NAMESPACE}" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo ""))
    
    if [ ${#PODS_IN_NS[@]} -gt 0 ]; then
        echo "   발견된 Pod (${#PODS_IN_NS[@]}개):"
        for pod in "${PODS_IN_NS[@]}"; do
            # Pod가 ReplicaSet에 의해 관리되는지 확인
            owner_kind=$(kubectl get pod "${pod}" -n "${NAMESPACE}" -o jsonpath='{.metadata.ownerReferences[0].kind}' 2>/dev/null || echo "")
            if [ "$owner_kind" = "ReplicaSet" ]; then
                status=$(kubectl get pod "${pod}" -n "${NAMESPACE}" -o jsonpath='{.status.phase}' 2>/dev/null || echo "Unknown")
                echo "   - ${pod} (status: ${status})"
                POD_LIST+=("${NAMESPACE}/${pod}")
                TOTAL_PODS=$((TOTAL_PODS + 1))
            fi
        done
    else
        echo "   Pod 없음"
    fi
    echo ""
done

if [ $TOTAL_RS -eq 0 ] && [ $TOTAL_PODS -eq 0 ]; then
    echo "✅ 삭제할 레플리카셋 및 Pod가 없습니다."
    exit 0
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  경고: 다음 리소스를 삭제하려고 합니다."
echo "   • 레플리카셋: ${TOTAL_RS}개"
echo "   • Pod: ${TOTAL_PODS}개"
echo ""
echo "주의사항:"
echo "  • Deployment가 관리하는 ReplicaSet을 삭제하면"
echo "    Deployment가 자동으로 새로운 ReplicaSet을 생성합니다."
echo "  • Pod를 삭제하면 Deployment가 새로운 Pod를 생성합니다."
echo "  • StatefulSet이나 DaemonSet은 영향을 받지 않습니다."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
read -p "정말로 모든 레플리카셋과 Pod를 삭제하시겠습니까? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "❌ 취소되었습니다."
    exit 0
fi

echo ""
echo "🗑️  Pod 삭제 중..."
echo ""

DELETED_PODS=0
FAILED_PODS=0

for pod_entry in "${POD_LIST[@]}"; do
    IFS='/' read -r namespace pod_name <<< "$pod_entry"
    
    if kubectl delete pod "${pod_name}" -n "${namespace}" --grace-period=0 --force --ignore-not-found 2>/dev/null; then
        echo "✅ ${namespace}/${pod_name} 삭제 완료"
        DELETED_PODS=$((DELETED_PODS + 1))
    else
        echo "❌ ${namespace}/${pod_name} 삭제 실패"
        FAILED_PODS=$((FAILED_PODS + 1))
    fi
done

echo ""
echo "🗑️  레플리카셋 삭제 중..."
echo ""

DELETED_RS=0
FAILED_RS=0

for rs_entry in "${RS_LIST[@]}"; do
    IFS='/' read -r namespace rs_name <<< "$rs_entry"
    
    if kubectl delete replicaset "${rs_name}" -n "${namespace}" --ignore-not-found 2>/dev/null; then
        echo "✅ ${namespace}/${rs_name} 삭제 완료"
        DELETED_RS=$((DELETED_RS + 1))
    else
        echo "❌ ${namespace}/${rs_name} 삭제 실패"
        FAILED_RS=$((FAILED_RS + 1))
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 삭제 결과:"
echo ""
echo "Pod:"
echo "   성공: ${DELETED_PODS}개"
echo "   실패: ${FAILED_PODS}개"
echo "   전체: ${TOTAL_PODS}개"
echo ""
echo "레플리카셋:"
echo "   성공: ${DELETED_RS}개"
echo "   실패: ${FAILED_RS}개"
echo "   전체: ${TOTAL_RS}개"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $FAILED_PODS -eq 0 ] && [ $FAILED_RS -eq 0 ]; then
    echo "✅ 모든 레플리카셋 및 Pod 삭제 완료!"
else
    echo "⚠️  일부 리소스 삭제에 실패했습니다."
    exit 1
fi
