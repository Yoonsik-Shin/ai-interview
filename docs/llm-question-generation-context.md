# LLM 질문 생성 시 컨텍스트 주입 분석

> 면접 질문 생성(꼬리질문 / 새 질문) 시 이력서, 자기소개, 회사정보, 페르소나, 대화 히스토리가 어떻게 LLM에 전달되는지 정리한 문서입니다.
> 이력서 검증, 모순 탐지, 페르소나별 질문 도메인 제한 구현 내용을 포함합니다.

---

## 1. 전체 흐름

```
면접자 답변 수신 (Core)
  └─ ProcessUserAnswerInteractor
       └─ CallLlmCommand 생성
            └─ LlmGrpcAdapter (gRPC)
                 └─ grpc_handler.py: GenerateResponse
                      └─ LangGraph 노드 실행
                           ├─ fetch_context   → 컨텍스트 수집
                           ├─ analyze         → 답변 분석 (꼬리질문 여부 판단)
                           ├─ router          → 다음 발화자(페르소나) 선택
                           └─ get_prompt_messages → 프롬프트 조립 → LLM 호출
```

---

## 2. 컨텍스트별 전달 현황

| 항목 | 전달 여부 | 수집 방식 | 주입 위치 |
|------|:---------:|-----------|-----------|
| 이력서 | ✅ | Resume Service gRPC → RAG 상위 5청크 | system prompt |
| 자기소개 | ✅ | Redis 해시 `interview:{id}:state` 조회 | system prompt |
| 회사정보 | ✅ | Tavily API 웹 검색 | system prompt |
| 페르소나 | ✅ | YAML 템플릿 (role + personality) | system prompt |
| 이전 AI 메시지 | ✅ | LangGraph RedisSaver 체크포인터 | history (messages 리스트) |
| 면접자 메시지 | ✅ | 현재 입력 직접 추가, 이전 답변은 history | messages 리스트 말미 |

---

## 3. 최종 프롬프트 구조

LLM에 전달되는 `messages` 리스트는 아래 순서로 구성됩니다.

```
[SystemMessage]
  ├─ 페르소나 역할 프롬프트 (ROLE_PROMPTS[next_speaker_id])
  ├─ 페르소나 성격 프롬프트 (PERSONALITY_PROMPTS[personality_key])
  ├─ 공통 지침 (COMMON_INSTRUCTION)
  ├─ 포맷 변수: 남은 시간, 난이도 레벨
  └─ [사전 컨텍스트 정보]
       ├─ 회사정보 (Tavily 검색 결과)
       ├─ 이력서 (RAG 청크)
       ├─ 자기소개 ([지원자 자기소개] 레이블과 함께)
       └─ 현재 단계 가이드 (STAGE_INSTRUCTIONS[stage])

[history]  ← LangGraph 체크포인터에서 복원
  ├─ AIMessage (이전 면접관 질문)
  ├─ HumanMessage (이전 면접자 답변)
  └─ ... (반복)

[HumanMessage]  ← 현재 면접자 답변
```

---

## 4. 노드별 상세 동작

### 4-1. `fetch_context` 노드
컨텍스트가 state에 없을 경우 수집합니다.

- **회사정보**: `company_name` + `domain`으로 Tavily API 검색 → `state["company_context"]`
- **이력서**: Resume Service에 gRPC 호출 → 상위 5청크 반환 → `state["resume_context"]`
- **자기소개**: Redis 해시에서 조회 → `state["self_intro_text"]`

### 4-2. `analyze` 노드
현재 면접자 답변을 분석하여 다음 질문 방향을 결정합니다.

analyzer에 전달되는 입력:

- `question`: 직전 AI 메시지 (면접관 질문)
- `answer`: 현재 면접자 답변
- `resume_context`: 이력서 RAG 청크
- `conversation_history`: 최근 10턴 히스토리 (텍스트 직렬화)

출력 필드:

| 필드 | 설명 |
| --- | --- |
| `understanding_score` | 답변 이해도 점수 (1~100) |
| `is_off_topic` | 주제 이탈 여부 |
| `suggested_difficulty_adjustment` | 난이도 조정 (-1 / 0 / 1) |
| `follow_up_needed` | 꼬리질문 필요 여부 |
| `follow_up_reason` | `RESUME_MISMATCH` / `CONTRADICTION` / `VAGUE` / null |
| `follow_up_hint` | 면접관이 반드시 짚어야 할 포인트 (한국어, nullable) |

**이력서 검증 규칙**: 답변에서 이력서에 없는 경험/기술을 주장하거나, 이력서에 명시된 내용을 부정하면 `RESUME_MISMATCH` 판정.

**모순 탐지 규칙**: 이전 답변에서 진술한 구체적 사실(경력 기간, 기술 스택 등)과 현재 답변이 상충하면 `CONTRADICTION` 판정.

우선순위: `RESUME_MISMATCH` > `CONTRADICTION` > `VAGUE`

### 4-3. `router` 노드
다음 발화자(페르소나)를 선택합니다.

- `analyze` 결과, 현재 참여 중인 페르소나 목록, 직전 발화자를 참고하여 선택
- 선택 결과는 `next_speaker_id`로 저장 → `get_prompt_messages`에서 사용

### 4-4. `get_prompt_messages` 노드
모든 컨텍스트를 조합하여 최종 프롬프트를 구성합니다.

```python
# 페르소나 템플릿 로드
system_text = f"{role_prompt}\n{personality_prompt}\n{COMMON_INSTRUCTION}"

# 컨텍스트 블록 주입
context_block = company_context + resume_context + f"[지원자 자기소개]\n{self_intro_text}"
system_text += f"\n\n[사전 컨텍스트 정보]{context_block}"

# 단계 가이드 추가
system_text += f"\n\n[현재 단계 가이드]\n{stage_instruction}"

# 최종 messages 조립
messages = [SystemMessage(system_text)] + history + [HumanMessage(user_input)]
```

---

## 5. 대화 히스토리 관리

- **저장소**: LangGraph `RedisSaver` (Redis Track 2)
- **식별자**: `thread_id = interview_id`
- **복원 시점**: `graph.invoke()` 호출 시 체크포인터가 자동 복원
- **압축 조건**: 메시지 수가 15턴을 초과하면 `summarize_memory` 노드에서 요약 압축

> ⚠️ 15턴 초과 시 오래된 대화 내용이 요약되어 세부 맥락이 일부 손실될 수 있습니다.

---

## 6. 알려진 제약 및 잠재 이슈

| 항목 | 이슈 | 영향 |
|------|------|------|
| 이력서 | 전체 텍스트가 아닌 RAG 상위 5청크만 사용 | 질문과 관련성 낮은 이력서 내용은 프롬프트에서 누락될 수 있음 |
| 회사정보 | Tavily API 외부 의존 | API 실패 시 회사 정보 없이 질문 생성됨 |
| 대화 히스토리 | 15턴 초과 시 요약 압축 | 초반 대화의 세부 맥락 손실 가능 |
| 지원 포지션 | company + domain만 있고 JD(직무 설명) 없음 | 직무 특화 질문 생성이 어려울 수 있음 |
| 자기소개 | 자기소개 단계 완료 전에는 Redis에 없음 | 초기 단계에서는 자기소개 컨텍스트 미사용 |

---

## 7. 관련 파일

| 파일 | 역할 |
|------|------|
| `services/domains/interview/.../ProcessUserAnswerInteractor.java` | `CallLlmCommand` 생성 |
| `services/domains/interview/.../LlmGrpcAdapter.java` | gRPC `GenerateRequest` 변환 |
| `services/infra/llm/service/grpc_handler.py` | 초기 state 구성, LangGraph 호출 |
| `services/infra/llm/service/graph.py` | LangGraph 워크플로우 정의 |
| `services/infra/llm/service/nodes.py` | fetch_context, analyze, router, get_prompt_messages 구현 |
| `services/proto/interview/v1/interview.proto` | gRPC 메시지 스펙 |
