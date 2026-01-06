#!/bin/bash

# PostgreSQL에서 Oracle DB로 마이그레이션 스크립트
# 사용법: ./scripts/migrate-to-oracle.sh [NAMESPACE]
# 참고: .env 파일에서 환경 변수를 로드합니다. .env.example을 참고하세요.

set -e

# 프로젝트 루트 디렉토리로 이동
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

# .env 파일 로드 (존재하는 경우)
if [ -f .env ]; then
    echo "📝 .env 파일에서 환경 변수를 로드합니다..."
    set -a
    source .env
    set +a
else
    echo "⚠️  .env 파일이 없습니다. .env.example을 복사하여 .env 파일을 생성하세요."
    echo "   cp .env.example .env"
    echo ""
fi

NAMESPACE=${1:-${NAMESPACE:-"unbrdn"}}

echo "🔄 PostgreSQL → Oracle DB 마이그레이션을 시작합니다..."
echo "📁 네임스페이스: ${NAMESPACE}"
echo ""

# 1. PostgreSQL 데이터 백업
echo "📦 PostgreSQL 데이터 백업 중..."
if kubectl get pod -l app=postgres -n ${NAMESPACE} 2>/dev/null | grep -q postgres; then
    POSTGRES_POD=$(kubectl get pod -l app=postgres -n ${NAMESPACE} -o jsonpath='{.items[0].metadata.name}')
    echo "Postgres Pod: ${POSTGRES_POD}"
    
    # 데이터 덤프 (-it 옵션 제거, 백업은 선택사항)
    BACKUP_FILE="postgres_backup_$(date +%Y%m%d_%H%M%S).sql"
    echo "백업 파일 생성 중: ${BACKUP_FILE}"
    
    if kubectl exec ${POSTGRES_POD} -n ${NAMESPACE} -- pg_dump -U postgres interview_db > ${BACKUP_FILE} 2>&1; then
        if [ -s "${BACKUP_FILE}" ]; then
            echo "✅ 백업 완료: ${BACKUP_FILE}"
        else
            echo "⚠️  백업 파일이 비어있습니다. 데이터가 없을 수 있습니다."
            echo "   계속 진행합니다..."
        fi
    else
        echo "⚠️  백업 중 오류 발생. 계속 진행합니다."
        rm -f ${BACKUP_FILE} 2>/dev/null || true
    fi
else
    echo "⚠️  Postgres Pod를 찾을 수 없습니다. 백업을 건너뜁니다."
fi
echo ""

# 2. Oracle DB Secret 생성 확인
echo "🔐 Oracle DB Secret 확인 중..."
if ! kubectl get secret oracle-db-credentials -n ${NAMESPACE} &>/dev/null; then
    echo "⚠️  Oracle DB Secret이 없습니다."
    echo "다음 명령어로 생성하세요:"
    echo "  kubectl create secret generic oracle-db-credentials \\"
    echo "    --from-literal=username=ADMIN \\"
    echo "    --from-literal=password='<YOUR_PASSWORD>' \\"
    echo "    -n ${NAMESPACE}"
    exit 1
fi
echo "✅ Oracle DB Secret 존재 확인"
echo ""

# 3. ConfigMap 확인
echo "⚙️  ConfigMap 확인 중..."
if ! kubectl get configmap core-config -n ${NAMESPACE} &>/dev/null; then
    echo "⚠️  core-config ConfigMap이 없습니다."
    echo "다음 명령어로 생성하세요:"
    echo "  kubectl create configmap core-config \\"
    echo "    --from-literal=datasource-url='jdbc:oracle:thin:@<HOST>:1522/<SERVICE_NAME>' \\"
    echo "    --from-literal=kafka-bootstrap-servers='kafka-cluster-kafka-bootstrap.kafka:9092' \\"
    echo "    -n ${NAMESPACE}"
    exit 1
fi

# ConfigMap의 datasource-url 확인
DATASOURCE_URL=$(kubectl get configmap core-config -n ${NAMESPACE} -o jsonpath='{.data.datasource-url}')
if [[ "$DATASOURCE_URL" == *"<ORACLE_DB_HOST>"* ]] || [[ "$DATASOURCE_URL" == *"jdbc:postgresql"* ]]; then
    echo "⚠️  ConfigMap의 datasource-url이 아직 설정되지 않았습니다."
    echo "현재 값: ${DATASOURCE_URL}"
    echo "실제 Oracle DB URL로 업데이트하세요."
    exit 1
fi
echo "✅ ConfigMap 확인 완료"
echo ""

# 4. 이미지 재빌드 안내
echo "📦 이미지 재빌드 필요:"
echo "   cd services/core"
echo "   ./gradlew build"
echo "   cd ../.."
IMAGE_REGISTRY_VAL=${IMAGE_REGISTRY:-"ap-chuncheon-1.ocir.io/axrywc89b6lf"}
IMAGE_TAG_VAL=${IMAGE_TAG:-"v1.1.0"}
echo "   ./scripts/build-images.sh ${IMAGE_REGISTRY_VAL} ${IMAGE_TAG_VAL} linux/arm64"
echo ""

# 5. Core Deployment 업데이트
read -p "Core Deployment를 업데이트하시겠습니까? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔄 Core Deployment 업데이트 중..."
    export IMAGE_REGISTRY=${IMAGE_REGISTRY:-"ap-chuncheon-1.ocir.io/axrywc89b6lf"}
    export IMAGE_TAG=${IMAGE_TAG:-"v1.1.0"}
    envsubst < k8s/apps/core/deployment-prod.yaml | kubectl apply -f -
    echo "✅ Deployment 업데이트 완료"
else
    echo "⏭️  Deployment 업데이트를 건너뜁니다."
fi
echo ""

# 6. Postgres Pod 제거 안내
echo "🗑️  Postgres Pod 제거:"
read -p "Postgres StatefulSet을 삭제하시겠습니까? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Postgres StatefulSet 삭제 중..."
    kubectl delete statefulset postgres -n ${NAMESPACE} --ignore-not-found=true
    echo "✅ Postgres StatefulSet 삭제 완료"
else
    echo "⏭️  Postgres StatefulSet 삭제를 건너뜁니다."
fi
echo ""

# 7. Core Pod 확장
echo "📈 Core Pod 확장:"
read -p "Core Pod를 2개로 확장하시겠습니까? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📈 Core Pod 확장 중..."
    kubectl scale deployment core -n ${NAMESPACE} --replicas=2
    echo "✅ Core Pod 확장 완료"
    
    echo "⏳ Pod 상태 확인 중..."
    sleep 5
    kubectl get pods -n ${NAMESPACE} -l app=core
else
    echo "⏭️  Core Pod 확장을 건너뜁니다."
fi
echo ""

echo "✅ 마이그레이션 준비 완료!"
echo ""
echo "📋 다음 단계:"
echo "   1. OCI Autonomous Database 생성 (docs/oracle-db-setup.md 참고)"
echo "   2. ConfigMap의 datasource-url을 실제 Oracle DB URL로 업데이트"
echo "   3. 이미지 재빌드 및 배포"
echo "   4. Core Pod 로그 확인하여 연결 성공 여부 확인"

