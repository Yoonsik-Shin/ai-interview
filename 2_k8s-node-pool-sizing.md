# 핵심 기술 의사결정 2: 인프라 리소스 한계 극복 및 쿠버네티스 노드 풀 사이징 과정

## 1. 배경 및 문제 상황 (Free Tier의 한계와 파드 축출)

초기 프로젝트 인프라는 비용 효율성을 위해 Oracle Cloud(OCI) Always Free 티어에서 제공하는 최대 자원인 **4 OCPU, 24GB Memory** (ARM 기반) 단일 노드 또는 2 OCPU 2Node 구성으로 출발했습니다.

하지만 진정한 "자체 AI 서빙"을 구현하기 위해서는 외부 API 의존도를 낮춰야 했고, 이에 따라 STT(Whisper)와 TTS 모델을 내부에 직접 호스팅하기로 결정했습니다.
문제는 인식률이 높은 STT 모델의 경우 파드(Pod) 하나당 **최소 1 OCPU (1000m)** 이상의 높은 연산량을 지속적으로 요구한다는 점이었습니다.

당시 4 OCPU 환경에서 Backend 4개, DB/Infra (Kafka, Redis, Oracle DB), Monitoring, 그리고 AI 파드 2대를 동시에 띄우려 하자 심각한 자원 경합이 발생했습니다. 결과적으로 `requests`가 노드 가용량을 초과하면서 Kubelet에 의한 **파드 축출(Eviction)** 및 `Pending` 상태의 무한루프라는 치명적인 장애를 겪었습니다.

```text
[ ASCII Art: 4 OCPU 환경에서의 자원 경합 및 파드 축출(Eviction) ]

+----------------- 단일 노드 (4 OCPU) -----------------+
| [Core] [BFF] [Kafka] [Redis] [DB] [Monitoring]       |
| .................................................... |
| [STT Pod 1 (최소 1 CPU 요구)]                          |
| [STT Pod 2 (최소 1 CPU 요구)]  <--- 자원 초과 (Pending / Eviction 발생) |
| [LLM Pod 1] [LLM Pod 2]                              |
+------------------------------------------------------+
```

---

## 2. 해결 방안 1: 인프라 스케일업 결단

안정적인 무중단 AI 서빙 환경을 구축하기 위해 물리적 자원의 확장이 불가피했습니다. 자체 AI 내재화라는 프로젝트의 스펙타클한 도전 과제를 위해 유료 과금을 감수하고 **2 OCPU를 추가 증설하여 총 6 OCPU, 24GB 환경**으로 클러스터 전체 리소스를 확장하는 과감한 결정을 내렸습니다.

---

## 3. 해결 방안 2: 최적의 쿠버네티스 노드 풀(Node Pool) 사이징 벤치마크

6 OCPU 자원을 확보한 후, 이를 어떻게 Node로 쪼갤 것인가에 대한 아키텍처적 고민이 이어졌습니다. 두 가지 구성을 두고 치열한 벤치마크 테스트를 진행했습니다.

```mermaid
graph TD
    subgraph Option A: 2 OCPU 3 Node
        Node1[Node 1: 2 OCPU] --> P1[STT 파드 1<br>여유 부족]
        Node2[Node 2: 2 OCPU] --> P2[STT 파드 2<br>여유 부족]
        Node3[Node 3: 2 OCPU] --> P3[기타 파드들]
    end

    subgraph Option B: 3 OCPU 2 Node (최종 채택)
        Node4[Node A: 3 OCPU] --> P4[STT 파드 1<br>충분한 여유]
        Node4 --> P5[BFF, Core 등]
        Node5[Node B: 3 OCPU] --> P6[STT 파드 2<br>충분한 여유]
        Node5 --> P7[LLM, DB 등]
    end

    style Option B fill:#e6ffe6,stroke:#333,stroke-width:2px
    style Option A fill:#ffe6e6,stroke:#333
```

### [Option A] 2 OCPU 8GB × 3 Node 구성

- **장점**: Kafka 3대 브로커와 Redis의 High Availability(HA) 분산 배치 시 `podAntiAffinity` 및 `topologySpreadConstraints`를 완벽히 만족할 수 있음.
- **단점**: 노드당 가용 CPU가 O/S 및 Kubelet 점유율을 제외하면 약 1.8 OCPU에 불과함. STT 파드(1 CPU request) 하나가 뜨면 노드 CPU의 절반 이상을 점유해버려, 다른 무거운 파드가 동일 노드에 뜰 경우 즉각적인 병목 발생.

### [Option B] 3 OCPU 12GB × 2 Node 구성 (최종 채택)

- **장점**: 노드당 가용 CPU가 넓어(약 2.8 OCPU) 단일 연산 중심의 거대한 AI 파드(STT/LLM)를 띄워도 여유 자원(버퍼)이 넉넉하여 경합이 덜함.
- **결정 사유**: AI 면접의 핵심은 '실시간성'입니다. 모니터링이나 특정 인프라의 다중화 결여(HA 다소 축소)보다는, **오디오 데이터를 변환하는 STT 컨테이너가 CPU Throttling 없이 온전한 연산력을 보장받는 것(성능)**이 압도적으로 중요하다고 판단했습니다.

---

## 4. 해결 방안 3: 정교한 Resource Tuning과 로우 리소스 프로파일 도입

노드 사이징만으로는 6 OCPU의 한계를 완벽히 커버할 수 없어, Kubernetes 매니페스트(YAML)를 바닥부터 뜯어고치는 튜닝 작업을 병행했습니다. (`resources.requests` 기준 총 7200m에 달하던 요구량을 3350m 이하로 감축)

1.  **모니터링 스택 경량화**: 필수적인 Prometheus 메트릭 수집만 남기고 Grafana/Loki 등의 풀스택 모니터링 도구 배포를 로우 환경에서는 제외할 수 있도록 옵트아웃 구조 적용.
2.  **App Replicas 최적화**: 로컬/개발 환경 기준 모든 백엔드 앱(BFF, Core, Socket)의 Replicas를 2에서 1로 축소.
3.  **STT CPU 최적화**: 1000m을 과감히 점유하던 STT `requests`를 `500m`로 낮추면서 AI 모델 경량화 혹은 스트리밍 청크 사이즈 조정으로 병목을 상쇄.
4.  **ResourceQuota 명시적 제한**: 네임스페이스의 `ResourceQuota`를 `requests.cpu: "6"`으로 재설정하여 어떤 상황에서도 워크로드가 전체 6 OCPU를 초과하여 Kubelet을 뻗게 만드는 대참사를 시스템 레벨에서 원천 차단했습니다.

---

## 5. 최종 결과 및 의의

- **외부망 독립 완료:** 값비싼 외부 클라우드 GPU나 상용 AI API에 의존하지 않고, 자체 구축한 한정된 자원(6 OCPU) 안에서 고성능 AI 모델 서빙을 오롯이 소화해냈습니다.
- **Eviction Zero:** 노드 풀(3 CPU 2 Node)의 구조적 한계를 뚫고 정교한 리소스 프로파일을 기획하여, 배포 중 발생하던 Pod Pending 및 메모리/CPU 부족으로 인한 Eviction 현상을 **0건**으로 근절시켰습니다.
- **스케줄링 이해도 증대:** Kubernetes의 `allocatable` 개념 파악, `topologySpreadConstraints`와 분산 선호도 조율을 수행하며 실제 트래픽이 쏠릴 시 파드가 어떻게 노드 간 분배되는지(Scheduling Pipeline)를 명확히 이해하고 통제할 수 있게 되었습니다.
