#!/bin/bash

# Oracle DB 설정 스크립트
# 사용법: ./scripts/setup-oracle-db.sh [NAMESPACE] [ORACLE_HOST] [ORACLE_SERVICE_NAME] [ORACLE_USERNAME] [ORACLE_PASSWORD]
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

# 환경변수 또는 파라미터에서 값 가져오기 (환경변수가 우선, 파라미터가 최우선)
NAMESPACE=${1:-${NAMESPACE:-"unbrdn"}}
ORACLE_HOST=${2:-${ORACLE_HOST:-""}}
ORACLE_SERVICE_NAME=${3:-${ORACLE_SERVICE_NAME:-""}}
ORACLE_USERNAME=${4:-${ORACLE_USERNAME:-"ADMIN"}}
ORACLE_PASSWORD=${5:-${ORACLE_PASSWORD:-""}}

echo "🔧 Oracle DB 설정을 시작합니다..."
echo "📁 네임스페이스: ${NAMESPACE}"
echo ""

# 1. 필수 파라미터 확인
if [ -z "$ORACLE_HOST" ] || [ -z "$ORACLE_SERVICE_NAME" ] || [ -z "$ORACLE_PASSWORD" ]; then
    echo "❌ 필수 파라미터가 누락되었습니다."
    echo ""
    echo "사용법:"
    echo "  ./scripts/setup-oracle-db.sh [NAMESPACE] [ORACLE_HOST] [ORACLE_SERVICE_NAME] [ORACLE_USERNAME] [ORACLE_PASSWORD]"
    echo ""
    echo "또는 .env 파일에 설정:"
    echo "  ORACLE_HOST=adb.ap-chuncheon-1.oraclecloud.com"
    echo "  ORACLE_SERVICE_NAME=your-service-name_high.adb.oraclecloud.com"
    echo "  ORACLE_USERNAME=ADMIN"
    echo "  ./scripts/setup-oracle-db.sh \"\" \"\" \"\" \"\" \"YourPassword123!\""
    echo ""
    echo "예시:"
    echo "  ./scripts/setup-oracle-db.sh unbrdn \\"
    echo "    adb.ap-chuncheon-1.oraclecloud.com \\"
    echo "    abc123xyz_interview_db_high.adb.oraclecloud.com \\"
    echo "    ADMIN \\"
    echo "    'YourPassword123!'"
    echo ""
    echo "💡 Oracle DB Connection Strings에서 다음 정보를 확인하세요:"
    echo "   1. OCI 콘솔 → Autonomous Database → Database Connection"
    echo "   2. Connection Strings 탭 → TLS 선택"
    echo "   3. Host와 Service Name 복사"
    exit 1
fi

# JDBC URL 생성
JDBC_URL="jdbc:oracle:thin:@${ORACLE_HOST}:1522/${ORACLE_SERVICE_NAME}"

echo "📋 설정 정보:"
echo "   Host: ${ORACLE_HOST}"
echo "   Service Name: ${ORACLE_SERVICE_NAME}"
echo "   Username: ${ORACLE_USERNAME}"
echo "   JDBC URL: ${JDBC_URL}"
echo ""

# 2. Secret 생성
echo "🔐 Oracle DB Secret 생성 중..."
kubectl create secret generic oracle-db-credentials \
  --from-literal=username="${ORACLE_USERNAME}" \
  --from-literal=password="${ORACLE_PASSWORD}" \
  -n ${NAMESPACE} \
  --dry-run=client -o yaml | kubectl apply -f -
echo "✅ Secret 생성 완료"
echo ""

# 3. ConfigMap 업데이트
echo "⚙️  ConfigMap 업데이트 중..."
kubectl create configmap core-config \
  --from-literal=datasource-url="${JDBC_URL}" \
  --from-literal=kafka-bootstrap-servers="kafka-cluster-kafka-bootstrap.kafka:9092" \
  -n ${NAMESPACE} \
  --dry-run=client -o yaml | kubectl apply -f -
echo "✅ ConfigMap 업데이트 완료"
echo ""

# 4. 설정 확인
echo "📊 설정 확인:"
echo ""
echo "Secret:"
kubectl get secret oracle-db-credentials -n ${NAMESPACE}
echo ""
echo "ConfigMap:"
kubectl get configmap core-config -n ${NAMESPACE} -o jsonpath='{.data.datasource-url}' && echo ""
echo ""

echo "✅ Oracle DB 설정이 완료되었습니다!"
echo ""
echo "📋 다음 단계:"
echo "   1. 이미지 재빌드:"
echo "      cd services/core"
echo "      ./gradlew build"
echo "      cd ../.."
echo "      ./scripts/build-images.sh ap-chuncheon-1.ocir.io/axrywc89b6lf v1.1.0 linux/arm64"
echo ""
echo "   2. 배포 및 마이그레이션:"
echo "      ./scripts/migrate-to-oracle.sh ${NAMESPACE}"

