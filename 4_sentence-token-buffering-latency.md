# 핵심 기술 의사결정 4: 첫 음성 응답 시간 최소화를 위한 문장 단위 토큰 버퍼링

## 1. 배경 및 문제 상황 (LLM 추론의 긴 오디오 공백 구간)

기존 파이프라인에서는 사용자의 답변("저의 장점은 꼼꼼함입니다.")이 들어오면 AI 시스템은 완성도 높은 하나의 논리적 구절(단락)을 모두 생성할 때까지 대기했습니다.
LLM 서비스(Python)가 응답을 생성(`Prompt` -> `Inference` -> `Completed Text`)하고 이를 Core 서버(Java)가 한 번에 모아서 TTS 서버로 넘기는 구조였습니다.

문제는 LLM이 면접관 페르소나에 맞춰 긴 꼬리 질문(약 100~150자)을 만들어내는 데 소요되는 Time-To-First-Token 후 전체 응답 대기 시간이었습니다. **TTS에서 음성으로 변환되어 실제 사용자 귀에 들리기까지 약 3~4초 이상의 정적(Silence)** 이 발생했고, 이 기나긴 "오디오 공백 구간"은 사용자로 하여금 통신이 끊겼는지 의문을 갖게 하여 실제 사람과 면접을 보는 듯한 "Real-time" 몰입감을 산산조각 냈습니다.

---

## 2. 해결 방안: 스트리밍 파이프라인과 문장 단위 버퍼링 (Sentence Token Accumulator)

사용자가 AI 면접관과 대화하는 느낌을 받기 위해서는, **전체 맥락 생성을 끝마쳤는지와 무관하게 LLM이 생각함과 동시에 입(TTS)을 떼게 만드는 파이프라인** 개편이 절대적이었습니다. 즉, **"첫 응답 도달 시간"**을 극한으로 단축해야만 했습니다.

### [Phase 1] Token Streaming

LLM 서버가 텍스트를 일괄 전송하지 않고, LangChain의 Token Iterator를 gRPC 스트림으로 연결해 한 글자(혹은 단어 형태소 단위)가 추론될 때마다 즉각 발사(`yield`)하도록 1차 변경을 단행했습니다.

### [Phase 2] TTS의 기술적 한계와 Token Accumulator의 탄생

"첫 토큰"을 가져왔으니 바로 TTS를 돌리고 싶었으나, TTS 모델은 문장의 인토네이션(억양)과 운율을 자연스럽게 살려내기 위해 **최소 하나의 논리적 "문장(Sentence)" 단위**를 입력으로 받아야만 사람다운 소리가 나온다는 근본적 한계가 있었습니다.

이를 위해 Core Service에 `TokenAccumulator` 라는 버퍼링 클래스를 설계하여 **"문장 단위 청크 버퍼링 로직"**을 구체화했습니다.

#### 작동 원리 (`ProcessLlmTokenInteractor.java` 중심)

1.  **스트림 수신 및 누적**: gRPC를 통해 LLM이 보내오는 `Token`을 메모리 공간(`sentenceBuffer`)에 차곡차곡 쌓으며 관찰합니다. (이때 프론트엔드 실시간 자막(Caption)용으로는 Pub/Sub으로 토큰 즉시 무지성 우회 발행)
2.  **문장 부호 감지 (isSentenceEnd 판별)**: 토큰에서 끝맺음 부호(`. `, `?`, `!`, `\n`)를 마주치는 순간, 축적된 `sentenceBuffer`의 텍스트를 잘라냅니다.
3.  **조기 발송 (Early TTS Trigger)**: 잘라낸 첫 번째 문장(예: "그렇군요, 지원자님.")을 곧바로 Redis List 기반의 `tts:sentence:queue`에 Push합니다.
4.  **병렬 생성과 재생 보장**: TTS 서버는 이 첫 문장만 가지고 즉각 음성 인코딩을 한 뒤 Redis Pub/Sub(`interview:audio`)으로 소켓에 쏴버립니다. 브라우저가 이걸 재생하고 있는 약 1~2초 동안, 백그라운드에서는 LLM이 계속 다음 문장을 만들어내고, 모이면 또 쏘고 하는 **병렬 워크플로우**가 무한히 맞물려 돌아가게 됩니다.

---

## 3. 도입 전/후 Latency 지표 및 아키텍처 다이어그램 비교

### Before: Batch & Block 방식

```text
[ ASCII Art: AS-IS Batch & Block (지연시간 3~5초) ]
LLM 추론: [단어1]..[단어2]..[단어3]............[단어100] (완료)
TTS 변환:                                         [==================>]
User 청취:                                                            (재생 시작)
```

- 단점: 3~5초의 공백. 오디오의 시작이 매우 느림.

### After: Sentence Token Buffering 방식

```text
[ ASCII Art: TO-BE Sentence Token Buffering (지연시간 800ms) ]
LLM 추론: [그][렇][군][요][.] (1문장 완료) [지][원][자][님] ...
TTS 변환:                  [====>]                 [====>]
User 청취:                       (재생 시작!)            (자연스럽게 이어짐)
```

```mermaid
sequenceDiagram
    participant U as User (Frontend)
    participant C as Core (Accumulator)
    participant L as LLM Service
    participant T as TTS Service

    C->>L: gRPC Streaming Request (답변 분석)
    L-->>C: Token: "그"
    L-->>C: Token: "렇군"
    L-->>C: Token: "요." (Sentence End Trigger!)
    C-xT: TTS Queue Push: "그렇군요."
    T-xU: Audio Chunk #1 도착 및 재생 시작 (사용자 대기시간 < 800ms)

    Note right of U: 브라우저가 "그렇군요" 말하고 있는 중...

    L-->>C: Token: "지원자"
    L-->>C: Token: "님, 예시가 "
    ... (중략)
    C-xT: TTS Queue Push: "지원자님, 예시가 있나요?"
    T-xU: Audio Chunk #2 도착 (대기열에서 연속 재생)
```

---

## 4. 최종 결과 및 의의

- **초기 응답시간(TTFA, Time-to-First-Audio) 5배 단축**: 이전 3.5초에서 개선 후 **평균 700ms~800ms 수준**으로 오디오 로딩 갭을 줄이는 눈부신 Latency 감소 효과를 거두었습니다.
- **자막과 음성의 이원화 분리**: 자막(Caption)은 토큰 단위(1글자)로 들어오자마자 화면에 타자기를 치듯 즉시 노출시키고, 음성은(문장) 단위로 버퍼를 두고 끊어 읽히게 하는 분리 패턴을 `ProcessLlmTokenInteractor` 레이어 하나에서 깔끔하게 구현했습니다.
- **사용자 경험(UX) 극대화**: 사용자가 답변을 마친 뒤 면접관이 잠깐 "흠.." 하고 생각한 뒤 바로 다음 질문의 운을 떼는 듯한 자연스럽고 쾌적한 인터랙션이 완성되었습니다. 이는 서비스의 몰입감을 100% 상승시킨 가장 중요한 최적화 결정 중 하나입니다.
