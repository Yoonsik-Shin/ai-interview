# AI 기반 HR/채용 솔루션 구축 및 인프라 전환 전략 보고서

## 1. 개요 및 아키텍처 비전

본 프로젝트는 실시간 화상 면접, 대용량 비정형 데이터(음성/영상) 분석, AI 역량 평가를 수행하는 지능형 채용 플랫폼 구축을 목표로 합니다. 기존의 모놀리식 구조를 탈피하여 **이벤트 기반 마이크로서비스 아키텍처(Event-Driven Microservices Architecture, EDMA)**를 채택하며, 기술적 완성도와 초기 비용 효율성을 동시에 달성하기 위해 **OCI Ampere(ARM64) 기반의 PoC**와 **AWS 기반의 프로덕션**이라는 이원화된 전략을 수립했습니다.

### 1.1 핵심 기술 목표

- **실시간성 보장:** Socket.io와 gRPC 양방향 스트리밍을 통한 밀리초(ms) 단위 지연 시간 달성.
- **느슨한 결합:** Kafka를 중추 신경망으로 활용하여 서비스 간 의존성 제거.
- **비용 효율성:** OCI 'Always Free' 티어의 ARM 인스턴스를 활용하여 인프라 비용 "0원" 달성.
- **데이터 무결성:** CQRS 및 Transactional Outbox 패턴을 통한 분산 트랜잭션 일관성 확보.

아래는 본 솔루션의 전체적인 이벤트 기반 마이크로서비스 아키텍처 다이어그램입니다.

!(image_0.png)

---

## 2. Phase 1: OCI 프리티어 기반 Zero-Cost 인프라 구축 (PoC)

초기 스타트업 및 연구 개발 단계에서의 비용 절감을 위해 OCI의 고성능 ARM 인스턴스를 활용합니다. 이는 AWS 무료 티어의 한계(메모리 부족)를 극복할 수 있는 유일한 대안입니다.

### 2.1 컴퓨팅 아키텍처: OKE와 Ampere A1

OCI는 4 OCPU(물리 코어 4개)와 24GB RAM을 무료로 제공합니다. 이는 JVM 기반의 Kafka와 메모리 집약적인 AI 모델을 동시에 구동하기에 충분한 리소스입니다.

- **오케스트레이션:** OCI OKE (Oracle Kubernetes Engine) Basic Cluster (Control Plane 무료).
- **노드 구성 전략:** 가용성과 리소스 효율성을 고려한 **2노드 분산 구성**.
  - **Node Shape:** `VM.Standard.A1.Flex` (ARM64)
  - **Spec:** 2 Nodes × (2 OCPUs, 12GB RAM).
  - **OS:** Oracle Linux Cloud Developer (AArch64).

### 2.2 스토리지 및 네트워크 최적화

OCI 프리티어의 제약 사항(스토리지 200GB, 로드밸런서 대역폭 10Mbps)을 극복하기 위한 기술적 우회 전략입니다.

- **스토리지 전략 (Tiered Storage):**
  - **부트 볼륨:** 노드당 50GB 할당 (총 100GB 소모).
  - **데이터 볼륨:** 잔여 100GB를 PVC로 할당하여 Kafka 및 DB에 사용.
  - **계층화(Tiering):** Kafka의 오래된 로그는 OCI Object Storage(무료 10GB)로 오프로딩하여 로컬 디스크 사용량 최소화.
- **네트워크 전략:**
  - **로드 밸런서:** OCI Flexible LB를 사용하되, 텍스트 트래픽(API, Socket)만 통과시킴.
  - **영상 트래픽(WebRTC):** P2P 통신을 원칙으로 하며, 서버 경유가 필요한 경우 대역폭 제한이 없는 인스턴스 직접 통신(NodePort/HostNetwork) 또는 유료 LB 증설 고려.
  - **아웃바운드:** 월 10TB 무료 트래픽을 활용하여 영상 데이터 전송 비용 절감.

---

## 3. Phase 2: 핵심 백엔드 및 이벤트 버스 구현

시스템의 중추인 메시징 큐와 데이터베이스를 ARM 아키텍처 호환성을 고려하여 구축합니다.

### 3.1 메시징 백본 (Kafka on Strimzi)

- **구축:** Strimzi Kafka Operator를 사용하여 Kubernetes 네이티브하게 구축. Strimzi는 ARM64를 공식 지원함.
- **구성:** Kafka Broker 3개, Zookeeper(또는 KRaft) 3개 구성.
- **메모리 튜닝:** Broker Heap 4GB, Zookeeper Heap 1GB 할당 (총 24GB 메모리 활용).

### 3.2 데이터베이스 (Managed Database)

**Oracle Autonomous Database (Always Free Tier)** 사용:

- **비용**: $0/월 (Always Free Tier)
- **구성**: 2 OCPU, 1TB 스토리지
- **장점**:
  - 리소스 절감 (200m CPU, 256Mi 메모리 확보)
  - 자동 백업 및 패치 관리
  - 고가용성 기본 제공
  - Zero-Cost 유지

**도입 이유:**

- Self-hosted PostgreSQL Pod 제거로 리소스 확보
- Core Pod 2개 실행 가능 (고가용성)
- 관리 부담 감소

자세한 설정 방법은 [oracle-db-setup.md](./oracle-db-setup.md)를 참조하세요.

아래 그림은 CQRS 패턴과 Transactional Outbox 패턴을 통한 데이터 흐름을 상세히 보여줍니다.

!(image_1.png)

---

## 4. Phase 3: CPU 기반 AI 서비스 최적화 (GPU-less)

OCI 프리티어에는 GPU가 제공되지 않으므로, CPU(Ampere A1)만으로 실시간 AI 추론을 수행할 수 있도록 경량화 및 최적화를 수행합니다.

### 4.1 AI 면접관 (LLM)

- **모델:** Llama 3 8B (Quantized).
- **최적화:** 4-bit 양자화(Q4_K_M)를 적용하여 모델 크기를 약 5.7GB로 축소.
- **성능:** OCI A1 4 OCPU 기준 초당 약 **30 토큰(TPS)** 생성 가능. 이는 실시간 대화에 충분한 속도임.

### 4.2 음성 및 영상 분석

- **STT (음성 인식):** Whisper.cpp 또는 Faster-Whisper(CTranslate2 기반)를 사용하여 Python 런타임 오버헤드 없이 고속 추론.
- **영상 분석:** 무거운 CNN 대신 **MediaPipe**를 활용하여 CPU만으로 얼굴 랜드마크 및 감정 분석 수행 (ARM NEON 가속 활용).
- **비동기 처리:** 실시간성이 덜 중요한 심층 분석은 Kafka 컨슈머를 통해 백그라운드에서 비동기로 처리.

---

## 5. Phase 4: 애플리케이션 개발 및 CI/CD

### 5.1 실시간 통신 (Socket.io & gRPC)

- **Socket Server:** Node.js 기반. Redis Adapter를 도입하여 다중 파드 간 메시지 브로드캐스팅 구현.
- **gRPC Streaming:** 오디오 데이터의 실시간 전송을 위해 HTTP/2 기반의 양방향 스트리밍 적용. Nginx Ingress Controller에서 gRPC 라우팅 처리.
- **Sticky Session:** `nginx.ingress.kubernetes.io/affinity: "cookie"` 설정을 통해 웹소켓 연결 안정성 확보.

### 5.2 멀티 아키텍처 빌드 (Docker Buildx)

개발 환경(x86)과 운영 환경(ARM64)의 아키텍처가 다르므로, Docker Buildx를 이용한 크로스 플랫폼 빌드가 필수적입니다.

```bash
# Docker Buildx를 사용한 ARM64 이미지 빌드 예시
docker buildx build --platform linux/arm64 -t my-registry/core-service:latest --push
```

---

## 6. AWS 프로덕션 전환 로드맵 (Future Step)

PoC 검증 완료 후 대규모 트래픽 처리가 필요한 시점에는 AWS 정석 아키텍처로 전환합니다. 이 과정에서 OCI PoC 구축 경험(ARM 호환성 등)은 그대로 재활용됩니다.

### 6.1 인프라 마이그레이션 (Terraform)

- **Compute:** AWS Graviton 3/4 (ARM64) 인스턴스 도입. OCI에서 사용한 Docker 이미지를 그대로 사용하며 비용 효율성 극대화.
- **Managed Services:**
  - Self-hosted Kafka -> **Amazon MSK**
  - Containerized DB -> **Amazon RDS / DocumentDB**
  - OCI OKE -> **AWS EKS**.

### 6.2 고성능 AI 추론 (GPU 도입)

- **인스턴스:** `g4dn.xlarge` (T4 GPU) 도입.
- **비용 절감:** AI 워크로드는 상태가 없으므로(Stateless), **Spot Instances**와 Karpenter를 활용하여 GPU 비용을 최대 70% 절감.

### 6.3 비용 및 성능 비교

| 항목         | OCI 프리티어 (PoC) | AWS 프로덕션 (Target) | 비고                     |
| :----------- | :----------------- | :-------------------- | :----------------------- |
| **비용**     | **$0 (Zero Cost)** | **$1,200+ / 월**      | 초기 비용 절감 효과 탁월 |
| **CPU**      | Ampere A1 (ARM)    | Graviton (ARM)        | 아키텍처 호환성 유지     |
| **AI 추론**  | CPU (양자화 모델)  | GPU (Full Precision)  | 서비스 품질 향상 시 전환 |
| **네트워크** | 10TB 무료          | GB당 과금             | 트래픽 최적화 필요       |

---

## 7. 인프라 설계 결정사항

### 7.1 Kubernetes 네임스페이스 설계

프로젝트는 **단일 네임스페이스(`unbrdn`) 패턴**을 사용합니다:

- **모든 리소스**: 인프라(Redis, Kafka)와 애플리케이션(BFF, Core, Inference, Socket) 모두 `unbrdn` 네임스페이스
- **Operator**: Strimzi Operator만 `kafka` 네임스페이스에 별도 설치 (클러스터 전체 watch)

**선택 이유:**

- 소규모 프로젝트에 적합
- 서비스 디스커버리 단순화 (같은 네임스페이스)
- 관리 단순성
- 단일 팀 운영

**대안 패턴:**

- 대규모 프로젝트: 인프라/애플리케이션 네임스페이스 분리
- 멀티 테넌트: Strimzi Operator 클러스터 전체 watch

### 7.2 데이터베이스 전환 결정

**PostgreSQL → Oracle Autonomous Database 전환**

**전환 전:**

- Self-hosted PostgreSQL Pod (200m CPU, 256Mi 메모리)
- Core Pod 2개 실행 불가 (리소스 부족)
- 수동 백업 및 패치 관리

**전환 후:**

- Oracle Autonomous Database Always Free Tier ($0/월)
- 리소스 확보: 200m CPU, 256Mi 메모리
- Core Pod 2개 실행 가능 (고가용성)
- 자동 백업 및 패치 관리

**비용 비교:**

- PostgreSQL (Self-hosted): $0/월 (하지만 클러스터 리소스 사용)
- Oracle DB (Always Free): $0/월 (클러스터 리소스 사용 없음)
- **효과**: Zero-Cost 유지 + 리소스 확보 + 관리 부담 감소

---

## 8. 결론

본 계획서는 **"기술적 부채 없는 비용 절감"**을 핵심 전략으로 제시합니다. OCI Ampere A1 기반의 PoC 구축은 단순한 무료 사용을 넘어, **Kubernetes, Kafka, ARM 아키텍처**라는 최신 기술 트렌드를 내재화하는 과정입니다.

1.  **즉시 실행:** OCI 계정 생성 및 OKE 클러스터 구축 (2노드 전략).
2.  **핵심 검증:** Docker Buildx 파이프라인 구성 및 Llama 3 CPU 추론 테스트.
3.  **확장 준비:** Terraform을 통한 인프라 코드화(IaC)로 향후 AWS 전환 대비.

이 전략을 통해 귀사는 초기 자본 지출 없이 엔터프라이즈급 AI 채용 솔루션의 기술적 타당성을 완벽하게 검증할 수 있습니다.
