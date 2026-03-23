"""
OpenAI API 래퍼 (STT의 engine/ 패턴)
"""
from openai import OpenAI
from config import OPENAI_API_KEY, OPENAI_MODEL, SYSTEM_PROMPT


class OpenAIEngine:
    def __init__(self):
        self.client = OpenAI(api_key=OPENAI_API_KEY)
        self.model = OPENAI_MODEL

    def generate_stream(self, user_text: str, history: list, stage: int = 5, persona: str = "COMFORTABLE", interviewer_count: int = 1, domain: str = "IT"):
        """OpenAI API 스트리밍 (Stage별 프롬프트 적용)"""
        system_prompt = self._generate_system_prompt(stage, persona, interviewer_count, domain)
        
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history)
        
        # SELF_INTRO 단계에서는 유저 텍스트를 히스토리에만 넣고 답변은 짧게 acknowledge 하거나
        # 타이머 초과 시 개입 멘트를 생성할 수 있음.
        # 하지만 현재 로직상 SELF_INTRO에서 LLM이 호출되면 "잘 들었습니다" 유도 프롬프트 사용
        messages.append({"role": "user", "content": user_text})

        # Stage별 max_tokens 조정
        max_tokens = 500
        if stage in [2, 3]: # GREETING, INTERVIEWER_INTRO
            max_tokens = 300
        elif stage == 4: # SELF_INTRO (Listening/Acknowledge)
            max_tokens = 100

        completion = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            stream=True,
            temperature=0.7,
            max_tokens=max_tokens,
        )

        for chunk in completion:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    def _generate_system_prompt(self, stage: int, persona: str, interviewer_count: int, domain: str) -> str:
        """Stage별 System Prompt 생성"""
        
        # 공통 기반 프롬프트
        base_role = f"너는 {domain} 분야의 전문 면접관이다. 현재 면접 분위기는 '{persona}' 스타일이다."
        
        if stage == 2: # GREETING
            return (
                f"{base_role} 지원자가 인사를 했다. "
                "반갑게 맞이해주고, 이어지는 '면접관 상세 소개' 단계로 자연스럽게 넘어가라. "
                "아직 본인 소개는 하지 마라. 짧게 한 문장으로 응답해라."
            )
            
        elif stage == 3: # INTERVIEWER_INTRO
            intro_style = {
                "COMFORTABLE": "부드럽고 친절하게",
                "PRESSURE": "날카롭고 압박감이 느껴지게",
                "RANDOM": "적당히 격식 있게"
            }.get(persona, "격식 있게")
            
            return (
                f"{base_role} 이제 면접관 소개 단계다. {intro_style} 소개해라. "
                f"오늘 면접에는 총 {interviewer_count}명의 면접관이 참여한다. "
                f"소개 후에는 '이제 지원자님의 자기소개를 1분 30초 내외로 부탁드립니다'라고 말하며 "
                "자기소개 단계로 넘어가라."
            )
            
        elif stage == 4: # SELF_INTRO
            return (
                f"{base_role} 지원자가 자기소개를 하고 있다. "
                "지원자의 말을 끊지 말고 경청하는 태도를 보여라. "
                "답변은 '네, 잘 듣고 있습니다. 계속 말씀해 주세요' 또는 '자기소개 감사합니다' 정도로 매우 짧게 해라."
            )
            
        else: # IN_PROGRESS (Default QA)
            return (
                f"{base_role} 10년 차 IT 개발자로서 지원자의 답변을 분석해라. "
                "내용이 빈약하거나 기술적으로 모호한 부분을 찾아 날카로운 꼬리 질문을 한 가지만 물어봐라. "
                "한 문장으로 짧게 물어보고, 존댓말을 사용해라."
            )

    @staticmethod
    def is_sentence_end(text: str) -> bool:
        """문장 끝 판별"""
        if not text or text[-1].isspace():
            return False
        return text.rstrip().endswith((".", "?", "!", "。", "！", "？", "~", "…"))
