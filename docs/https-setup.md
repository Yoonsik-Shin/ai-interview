# Kubernetes HTTPS 설정 가이드

이 문서는 Kubernetes 환경에서 HTTPS를 설정하는 방법을 설명합니다.

## 개요

프로젝트는 두 가지 환경에 대해 다른 HTTPS 설정 방식을 사용합니다:

- **프로덕션 환경**: Let's Encrypt + Cert-Manager (자동 인증서 관리)
- **로컬 환경**: 자체 서명 인증서 (개발/테스트용)

## 아키텍처

```
[사용자]
  ↓ HTTPS (443)
[Ingress Controller (Nginx)]
  ↓ HTTP (내부)
[서비스들: BFF, Socket, Kafka UI]
```

## 프로덕션 환경: Let's Encrypt + Cert-Manager

### 사전 요구사항

1. **도메인 필요**: Let's Encrypt는 유효한 도메인이 필요합니다.
2. **DNS 설정**: 도메인의 A 레코드가 Ingress IP를 가리켜야 합니다.
3. **Nginx Ingress Controller**: 이미 설치되어 있어야 합니다.

### 설치 단계

#### 1. Cert-Manager 설치

```bash
# Cert-Manager 설치
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.3/cert-manager.yaml

# 설치 확인
kubectl get pods -n cert-manager
kubectl get crd | grep cert-manager
```

#### 2. ClusterIssuer 설정

`k8s/infra/cert-manager/cluster-issuer-prod.yaml` 파일을 수정하여 이메일 주소를 설정합니다:

```yaml
spec:
  acme:
    email: your-email@example.com # 실제 이메일 주소로 변경
```

ClusterIssuer 배포:

```bash
kubectl apply -f k8s/infra/cert-manager/cluster-issuer-prod.yaml
```

#### 3. Ingress 설정

`k8s/common/ingress/ingress-prod.yaml` 파일에서 도메인을 설정합니다:

```yaml
spec:
  tls:
    - hosts:
        - your-domain.com # 실제 도메인으로 변경
      secretName: tls-secret
  rules:
    - host: your-domain.com # 실제 도메인으로 변경
```

Ingress 배포:

```bash
kubectl apply -f k8s/common/ingress/ingress-prod.yaml
```

#### 4. 인증서 발급 확인

인증서 발급은 몇 분이 걸릴 수 있습니다:

```bash
# Certificate 리소스 확인
kubectl get certificate -n unbrdn

# 인증서 상세 정보
kubectl describe certificate tls-secret -n unbrdn

# Cert-Manager 로그 확인
kubectl logs -n cert-manager -l app.kubernetes.io/instance=cert-manager
```

### 자동 배포

배포 스크립트를 사용하면 자동으로 Cert-Manager가 설치되고 설정됩니다:

```bash
./scripts/deploy-prod.sh [IMAGE_REGISTRY] [IMAGE_TAG]
```

### 인증서 갱신

Cert-Manager가 자동으로 인증서를 갱신합니다 (90일 주기). 수동 갱신이 필요한 경우:

```bash
# Certificate 리소스 삭제 후 재생성
kubectl delete certificate tls-secret -n unbrdn
kubectl apply -f k8s/common/ingress/ingress-prod.yaml
```

## 로컬 환경: 자체 서명 인증서

### 사전 요구사항

- OpenSSL 설치
- Kubernetes 클러스터 (Docker Desktop 등)

### 설치 단계

#### 1. 자체 서명 인증서 생성

```bash
./scripts/generate-self-signed-cert.sh
```

이 스크립트는 다음을 수행합니다:

1. 개인키 생성 (`tls.key`)
2. 인증서 서명 요청 생성 (`tls.csr`)
3. 자체 서명 인증서 생성 (`tls.crt`, 유효기간: 365일)
4. Kubernetes Secret 생성 (`tls-secret`)

#### 2. Ingress 배포

```bash
kubectl apply -f k8s/common/ingress/ingress-local.yaml
```

### 자동 배포

배포 스크립트를 사용하면 자동으로 인증서가 생성됩니다:

```bash
./scripts/deploy-local.sh
```

### 브라우저 경고 해결

자체 서명 인증서는 브라우저에서 경고가 표시됩니다. 다음 단계로 접속할 수 있습니다:

1. 브라우저에서 "고급" 클릭
2. "안전하지 않음으로 이동" 또는 "계속 진행" 클릭

**참고**: 자체 서명 인증서는 개발/테스트 환경에서만 사용하고, 프로덕션에서는 절대 사용하지 마세요.

## HTTP to HTTPS 리다이렉션

두 환경 모두 HTTP 요청을 자동으로 HTTPS로 리다이렉션합니다. 이는 다음 annotation으로 설정됩니다:

```yaml
annotations:
  nginx.ingress.kubernetes.io/ssl-redirect: "true"
```

## 트러블슈팅

### 프로덕션 환경

#### 인증서가 발급되지 않음

1. **DNS 설정 확인**:

   ```bash
   nslookup your-domain.com
   ```

2. **Ingress IP 확인**:

   ```bash
   kubectl get ingress main-ingress -n unbrdn
   ```

3. **Cert-Manager 로그 확인**:

   ```bash
   kubectl logs -n cert-manager -l app.kubernetes.io/instance=cert-manager
   ```

4. **Certificate 이벤트 확인**:
   ```bash
   kubectl describe certificate tls-secret -n unbrdn
   ```

#### Rate Limit 초과

Let's Encrypt는 주간 인증서 발급 제한이 있습니다. 테스트 시에는 Staging 환경을 사용하세요:

```yaml
# cluster-issuer-prod.yaml에서 staging issuer 사용
cert-manager.io/cluster-issuer: "letsencrypt-staging"
```

#### 인증서 갱신 실패

1. Cert-Manager Pod 재시작:

   ```bash
   kubectl rollout restart deployment cert-manager -n cert-manager
   ```

2. Certificate 리소스 재생성:
   ```bash
   kubectl delete certificate tls-secret -n unbrdn
   kubectl apply -f k8s/common/ingress/ingress-prod.yaml
   ```

### 로컬 환경

#### 인증서 생성 실패

1. **OpenSSL 설치 확인**:

   ```bash
   openssl version
   ```

2. **권한 확인**:

   ```bash
   chmod +x scripts/generate-self-signed-cert.sh
   ```

3. **Secret 확인**:
   ```bash
   kubectl get secret tls-secret -n unbrdn
   ```

#### HTTPS 접속 불가

1. **Ingress 확인**:

   ```bash
   kubectl get ingress main-ingress -n unbrdn
   kubectl describe ingress main-ingress -n unbrdn
   ```

2. **Ingress Controller 확인**:

   ```bash
   kubectl get pods -n ingress-nginx
   ```

3. **포트 확인**: 로컬 환경에서 443 포트가 열려있는지 확인하세요.

## 보안 고려사항

1. **프로덕션 환경**: 항상 Let's Encrypt와 같은 신뢰할 수 있는 CA의 인증서를 사용하세요.
2. **자체 서명 인증서**: 개발/테스트 환경에서만 사용하고, 프로덕션에서는 절대 사용하지 마세요.
3. **인증서 만료**: Cert-Manager가 자동으로 갱신하지만, 모니터링을 설정하는 것을 권장합니다.
4. **TLS 버전**: Nginx Ingress Controller는 기본적으로 최신 TLS 버전을 지원합니다.

## 참고 자료

- [Cert-Manager 공식 문서](https://cert-manager.io/docs/)
- [Let's Encrypt 문서](https://letsencrypt.org/docs/)
- [Nginx Ingress Controller TLS 설정](https://kubernetes.github.io/ingress-nginx/user-guide/tls/)
