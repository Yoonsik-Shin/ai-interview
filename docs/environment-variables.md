# 환경 변수 설정 가이드

이 프로젝트는 환경 변수를 사용하여 설정을 관리합니다.

## 빠른 시작

1. `.env.example` 파일을 `.env`로 복사:
   ```bash
   cp .env.example .env
   ```

2. `.env` 파일을 열어 실제 값으로 수정:
   ```bash
   # 에디터로 .env 파일 열기
   nano .env
   # 또는
   vim .env
   ```

3. 스크립트 실행 시 자동으로 `.env` 파일이 로드됩니다.

## 환경 변수 목록

### Docker Registry 설정
- `IMAGE_REGISTRY`: OCI Container Registry URL
- `IMAGE_TAG`: Docker 이미지 태그

### Kubernetes 설정
- `NAMESPACE`: Kubernetes 네임스페이스
- `OCI_KE_CONTEXT`: OCI OKE 클러스터 컨텍스트 이름

### Oracle Database 설정
- `ORACLE_HOST`: Oracle Autonomous Database 호스트
- `ORACLE_SERVICE_NAME`: Oracle Database 서비스 이름
- `ORACLE_USERNAME`: Oracle Database 사용자 이름
- `ORACLE_PASSWORD`: Oracle Database 비밀번호 (스크립트 파라미터로 직접 입력 권장)

### Docker Repository 이름
- `REPO_BFF`: BFF 서비스 Repository 이름
- `REPO_CORE`: Core 서비스 Repository 이름
- `REPO_INFERENCE`: Inference 서비스 Repository 이름
- `REPO_SOCKET`: Socket 서비스 Repository 이름

## 사용 예시

### 프로덕션 배포
```bash
# .env 파일에 설정된 값 사용
./scripts/deploy-prod.sh

# 또는 파라미터로 오버라이드
./scripts/deploy-prod.sh ap-chuncheon-1.ocir.io/axrywc89b6lf v1.0.0
```

### 이미지 빌드
```bash
# .env 파일에 설정된 값 사용
./scripts/build-images.sh

# 또는 파라미터로 오버라이드
./scripts/build-images.sh ap-chuncheon-1.ocir.io/axrywc89b6lf v1.0.0 linux/arm64
```

### Oracle DB 설정
```bash
# .env 파일에 설정된 값 사용
./scripts/setup-oracle-db.sh "" "" "" "" "YourPassword123!"

# 또는 파라미터로 오버라이드
./scripts/setup-oracle-db.sh unbrdn \
  adb.ap-chuncheon-1.oraclecloud.com \
  your-service-name_high.adb.oraclecloud.com \
  ADMIN \
  'YourPassword123!'
```

## 주의사항

1. **`.env` 파일은 Git에 커밋하지 마세요**
   - `.env` 파일은 `.gitignore`에 포함되어 있습니다.
   - `.env.example`만 Git에 포함됩니다.

2. **비밀번호는 환경 변수에 저장하지 마세요**
   - `ORACLE_PASSWORD`는 스크립트 파라미터로 직접 입력하세요.
   - 또는 Kubernetes Secret으로 관리하세요.

3. **환경 변수 우선순위**
   - 스크립트 파라미터 > 환경 변수 > 기본값
   - 파라미터로 전달된 값이 최우선으로 적용됩니다.

## 문제 해결

### `.env` 파일이 로드되지 않음
```bash
# .env 파일이 존재하는지 확인
ls -la .env

# .env.example을 복사하여 생성
cp .env.example .env
```

### 환경 변수가 적용되지 않음
```bash
# 환경 변수 확인
echo $IMAGE_REGISTRY
echo $NAMESPACE

# 스크립트에서 직접 확인
./scripts/deploy-prod.sh
```
