"""
LLM 인스턴스 팩토리 - Azure OpenAI(prod) / OpenAI(local) 자동 선택
"""
from config import (
    OPENAI_API_KEY,
    OPENAI_MODEL,
    AZURE_OPENAI_API_KEY,
    AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_DEPLOYMENT_ID,
)


def _is_azure() -> bool:
    return bool(AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_DEPLOYMENT_ID)


def build_chat_llm(streaming: bool = False, temperature: float = 0.0):
    """Azure 환경변수가 모두 설정된 경우 AzureChatOpenAI, 아니면 ChatOpenAI 반환"""
    if _is_azure():
        from langchain_openai import AzureChatOpenAI
        return AzureChatOpenAI(
            azure_deployment=AZURE_OPENAI_DEPLOYMENT_ID,
            azure_endpoint=AZURE_OPENAI_ENDPOINT,
            api_key=AZURE_OPENAI_API_KEY,
            api_version="2024-02-01",
            streaming=streaming,
            temperature=temperature,
        )
    from langchain_openai import ChatOpenAI
    return ChatOpenAI(
        model=OPENAI_MODEL,
        api_key=OPENAI_API_KEY,
        streaming=streaming,
        temperature=temperature,
    )
