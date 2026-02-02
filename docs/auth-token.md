# 인증 토큰 설계 및 동작

## 개요
- 로그인 성공 시 access token과 refresh token을 발급합니다.
- access token은 인증/인가에 사용하고, refresh token은 access token 재발급에 사용합니다.

## 토큰 생성 로직
- 구현 위치: `services/core/src/main/java/me/unbrdn/core/auth/domain/service/JwtTokenProvider.java`
- 알고리즘: RS256
- 공통
  - subject: `userId`
  - issuedAt/expiration 설정
  - header: `kid` 포함
- Access token
  - 클레임: `role`, `typ=access`
  - 상대적으로 짧은 만료 시간
- Refresh token
  - 클레임: `typ=refresh`
  - 상대적으로 긴 만료 시간
- 키 처리
  - private/public key는 Base64(헤더 제거된 PEM) 또는 PEM 문자열을 허용
  - PEM 문자열인 경우 헤더/푸터를 제거하고 Base64로 디코딩

## 만료 시간/설정
- 초 단위로 설정합니다.
- 설정 키:
  - `jwt.access-token-expiration-seconds`
  - `jwt.refresh-token-expiration-seconds`
  - `jwt.keys[0].kid`
  - `jwt.keys[0].private-key`
  - `jwt.keys[0].public-key`
  - `jwt.keys[0].active`
  - `jwt.keys[1].kid` (옵션)
  - `jwt.keys[1].private-key` (옵션)
  - `jwt.keys[1].public-key` (옵션)
  - `jwt.keys[1].active` (옵션)
- 환경변수로 오버라이드:
  - `JWT_ACCESS_TOKEN_EXP_SECONDS`
  - `JWT_REFRESH_TOKEN_EXP_SECONDS`
  - `JWT_KEY_0_KID`
  - `JWT_KEY_0_PRIVATE_KEY`
  - `JWT_KEY_0_PUBLIC_KEY`
  - `JWT_KEY_0_ACTIVE`
  - `JWT_KEY_1_KID`
  - `JWT_KEY_1_PRIVATE_KEY`
  - `JWT_KEY_1_PUBLIC_KEY`
  - `JWT_KEY_1_ACTIVE`

## Refresh token 저장
- 구현 위치: `services/core/src/main/java/me/unbrdn/core/auth/adapter/out/persistence/RefreshTokenRedisAdapter.java`
- 저장소: Redis
- 키 형식: `auth:refresh-token:{userId}`
- TTL: refresh token 만료 시간과 동일하게 설정

## 인증 흐름
- 구현 위치: `services/core/src/main/java/me/unbrdn/core/auth/application/interactor/AuthenticateUserInteractor.java`
1. 이메일로 사용자 조회
2. 비밀번호 검증
3. access/refresh token 발급
4. refresh token을 Redis에 저장
5. 응답 DTO에 `accessToken`, `refreshToken`, `user` 포함

## 토큰 재발급 흐름
- 구현 위치: `services/core/src/main/java/me/unbrdn/core/auth/application/interactor/RefreshTokenInteractor.java`
1. refresh token 서명/만료/타입 검증
2. Redis 저장 토큰과 요청 토큰 일치 여부 확인
3. 사용자 조회 후 access/refresh token 재발급
4. Redis에 refresh token 갱신 저장

## gRPC 응답 구조
- `AuthenticateUserResponse`에 `User` 객체를 포함합니다.

```proto
message AuthenticateUserResponse {
  string access_token = 1;
  string refresh_token = 2;
  User user = 3;
}

message User {
  string userId = 1;
  string email = 2;
  string nickname = 3;
  string role = 4;
}
```

```proto
message RefreshTokenRequest {
  string refresh_token = 1;
}

message RefreshTokenResponse {
  string access_token = 1;
  string refresh_token = 2;
}
```

## BFF 검증 방식
- BFF는 JWKS 엔드포인트에서 공개키를 받아 access token을 검증합니다.
- JWKS URI: `/.well-known/jwks.json`
- BFF에는 `JWT_JWKS_URI`만 주입하고, private key는 Core에만 둡니다.

## JWKS 캐시 설정 (BFF)
- 기본값
  - 캐시 만료: 5분 (`JWT_JWKS_CACHE_MAX_AGE_MS`, 기본 300000)
  - 분당 요청 제한: 10회 (`JWT_JWKS_REQUESTS_PER_MINUTE`, 기본 10)
  - JWKS 요청 타임아웃: 30초 (`JWT_JWKS_TIMEOUT_MS`, 기본 30000)
- 운영 환경에서 회전 빈도와 장애 대응 정책에 맞게 조정하세요.

## JWKS/키 회전
- Core는 모든 공개키를 JWKS로 노출하고, 서명에 사용할 활성 키를 1개로 지정합니다.
- 키 회전 절차
  1. 새 키를 추가하고 `active=true`로 지정
  2. 기존 키는 `active=false`로 유지하여 검증만 가능하게 둠
  3. 기존 토큰 만료 후 오래된 키 제거
- 설정 예시 (환경변수)
  - `JWT_KEY_0_KID`, `JWT_KEY_0_PRIVATE_KEY`, `JWT_KEY_0_PUBLIC_KEY`, `JWT_KEY_0_ACTIVE`
  - `JWT_KEY_1_KID`, `JWT_KEY_1_PRIVATE_KEY`, `JWT_KEY_1_PUBLIC_KEY`, `JWT_KEY_1_ACTIVE`

## 키 발급 스크립트
- `scripts/generate-jwt-keys.sh` 실행으로 RSA 키 페어와 환경변수 템플릿을 생성합니다.

## 키 발급/배포 절차 (권장)
1. `./scripts/generate-jwt-keys.sh` 실행으로 새 키 페어 생성
2. Core에만 private/public key를 배포
3. BFF에는 JWKS URI만 배포 (`JWT_JWKS_URI`)
4. 배포 후 `/.well-known/jwks.json` 응답 확인

## 키 회전 자동화 (스크립트/CI)
- 권장 흐름
  1. 스크립트 실행으로 새 키 생성 (`scripts/generate-jwt-keys.sh`)
  2. Secret Manager/CI 변수로 `JWT_KEY_1_*` 등록
  3. Core 배포 (active 키 전환)
  4. JWKS 정상 노출 확인 후 BFF 재시작(또는 캐시 만료 대기)
  5. 토큰 만료 경과 후 오래된 키 제거
- 자동화 팁
  - kid는 `YYYY-MM` 또는 배포 태그 기반으로 표준화
  - 키 파일/환경변수는 저장소에 커밋하지 않음
  - 배포 파이프라인에 "JWKS 확인" 단계 추가 (`curl /.well-known/jwks.json`)
  - K8s에서는 Secret 교체 후 Core 롤링 업데이트를 트리거

## 키 회전 상세 절차
1. 새 키를 `JWT_KEY_1_*`로 추가하고 `JWT_KEY_1_ACTIVE=true`
2. 기존 키는 `JWT_KEY_0_ACTIVE=false`로 바꿔 검증만 가능하게 유지
3. Core 배포 → JWKS에 두 키가 모두 노출되는지 확인
4. access/refresh 만료 기간이 지난 후 기존 키 제거

예시 환경변수:
```bash
# 신규 키 활성
JWT_KEY_0_KID=2025-01
JWT_KEY_0_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
JWT_KEY_0_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
JWT_KEY_0_ACTIVE=true

# 이전 키는 검증용으로만 유지
JWT_KEY_1_KID=2024-11
JWT_KEY_1_PRIVATE_KEY=""
JWT_KEY_1_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
JWT_KEY_1_ACTIVE=false
```

## 긴급 폐기 (키 유출 시)
1. 유출 의심 키를 설정에서 제거하거나 JWKS에서 제외
2. Core 재배포 후 JWKS 업데이트 확인
3. BFF 캐시 갱신(재시작 또는 캐시 만료 대기)
4. 모든 refresh token 폐기 전략(전량 무효화)이 필요하면 Redis 삭제/버전 변경 고려

## JWKS 캐시 동작
- BFF는 `jwks-rsa`를 사용해 JWKS를 캐시합니다.
- 빠른 회전을 원하면 캐시 만료 시간을 줄이거나 배포 시 BFF 재시작을 고려합니다.

## 운영/보안 고려사항
- RSA 2048비트 이상 키를 권장합니다.
- private key는 Core에만 두고 외부로 노출하지 않습니다.
- 환경변수/Secret 관리로 키를 주입하고, 운영 환경에서 기본값을 사용하지 않도록 합니다.
- Refresh token 폐기/회수 전략(로그아웃, 탈취 대응)은 별도 정책으로 확장 가능합니다.
