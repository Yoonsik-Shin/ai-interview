"""
면접 리포트 생성 엔진 - GPT-4o structured output
"""
import json
from utils.log_format import log_json


REPORT_SYSTEM_PROMPT = """당신은 면접 평가 전문가입니다. 아래 면접 대화 내역을 분석하여 지원자를 종합 평가해주세요.

평가 기준:
1. 논리력 및 문제 해결 능력 (25점)
2. 기술 이해도 및 전문 지식 (25점)
3. 의사소통 능력 (25점)
4. 태도 및 성장 가능성 (25점)

반드시 다음 JSON 형식으로만 응답하세요:
{
  "totalScore": <0-100 사이 정수>,
  "passFailStatus": "<PASS|FAIL|HOLD>",
  "summaryText": "<2-3문장의 전체 평가 요약>",
  "resumeFeedback": "<이력서 기반 개선점 또는 강점 피드백>"
}

passFailStatus 기준:
- PASS: 70점 이상
- HOLD: 50점 이상 70점 미만
- FAIL: 50점 미만
"""


def generate_report(messages: list) -> dict:
    """
    면접 대화 내역을 분석하여 리포트 생성

    Args:
        llm: ChatOpenAI 인스턴스
        messages: [{"role": str, "content": str, "stage": str}] 목록

    Returns:
        {"totalScore": int, "passFailStatus": str, "summaryText": str, "resumeFeedback": str}
    """
    log_json("report_engine_start", messageCount=len(messages))

    # 대화 내역을 텍스트로 변환 (SYSTEM/EVENT 메시지 제외, 실제 대화만 포함)
    conversation_lines = []
    for msg in messages:
        role = msg.get("role", "")
        content = msg.get("content", "")

        if role in ("USER", "AI") and content.strip():
            label = "지원자" if role == "USER" else "면접관"
            conversation_lines.append(f"[{label}] {content}")

    if not conversation_lines:
        log_json("report_engine_no_conversation")
        return {
            "totalScore": 0,
            "passFailStatus": "FAIL",
            "summaryText": "면접 대화 내역이 충분하지 않아 평가할 수 없습니다.",
            "resumeFeedback": "면접 데이터 부족으로 피드백을 제공할 수 없습니다.",
        }

    conversation_text = "\n".join(conversation_lines)

    from langchain_core.messages import SystemMessage, HumanMessage
    from engine.llm_factory import build_chat_llm

    response_llm = build_chat_llm(temperature=0.3)

    prompt_messages = [
        SystemMessage(content=REPORT_SYSTEM_PROMPT),
        HumanMessage(content=f"면접 대화 내역:\n\n{conversation_text}"),
    ]

    response = response_llm.invoke(prompt_messages)
    raw_content = response.content.strip()

    log_json("report_engine_raw_response", length=len(raw_content))

    # JSON 파싱
    # 코드 블록 제거 (```json ... ```)
    if raw_content.startswith("```"):
        lines = raw_content.split("\n")
        lines = [l for l in lines if not l.startswith("```")]
        raw_content = "\n".join(lines)

    result = json.loads(raw_content)

    total_score = int(result.get("totalScore", 0))
    pass_fail = result.get("passFailStatus", "HOLD")
    if pass_fail not in ("PASS", "FAIL", "HOLD"):
        pass_fail = "HOLD"

    log_json(
        "report_engine_completed",
        totalScore=total_score,
        passFailStatus=pass_fail,
    )

    return {
        "totalScore": total_score,
        "passFailStatus": pass_fail,
        "summaryText": result.get("summaryText", ""),
        "resumeFeedback": result.get("resumeFeedback", ""),
    }
