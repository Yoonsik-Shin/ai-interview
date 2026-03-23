

import json
import random
from typing import List, Dict, Any, TypedDict, Optional, Union, Annotated
from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage
from langgraph.graph.message import add_messages
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import JsonOutputParser

from engine.prompts import ANALYZER_PROMPT, ROLE_PROMPTS, PERSONALITY_PROMPTS, STAGE_INSTRUCTIONS, COMMON_INSTRUCTION

class InterviewState(TypedDict):
    # Input
    history: Annotated[List[BaseMessage], add_messages]
    user_input: str
    available_roles: List[str] # List of Role names (e.g. "TECH", "HR")
    personality: str           # e.g. "PRESSURE", "COMFORTABLE"
    current_difficulty: int
    remaining_time: int
    total_duration: int
    last_interviewer_id: str
    stage: str 
    company_name: str
    domain: str
    company_context: str
    resume_context: str
    interview_id: str
    self_intro_text: str # 자기소개 무기한 보존용 피봇 필드
    
    # Internal / Output
    next_speaker_id: str # Will be one of available_roles (e.g. "TECH") or "CLOSING"
    next_difficulty: int
    reduce_total_time: bool
    is_ending: bool
    analysis_result: dict
    generated_response: str 

class InterviewNodes:
    def __init__(self, llm: ChatOpenAI):
        self.llm = llm
        self.analyzer_chain = ANALYZER_PROMPT | self.llm | JsonOutputParser()

    def fetch_context(self, state: InterviewState) -> Dict:
        """Fetch company news and resume context on the first turn."""
        updates = {}
        
        # 1. Company Search (Tavily)
        company = state.get("company_name", "")
        domain = state.get("domain", "")
        if company and company != "Unknown Company" and not state.get("company_context"):
            try:
                from langchain_community.tools.tavily_search import TavilySearchResults
                from config import TAVILY_API_KEY
                if TAVILY_API_KEY:
                    tool = TavilySearchResults(max_results=2, tavily_api_key=TAVILY_API_KEY)
                    query = f"{company} {domain} 기술 스택 채용 면접"
                    docs = tool.invoke({"query": query})
                    text = "\\n".join([d["content"] for d in docs])
                    updates["company_context"] = f"[기업 정보 검색 결과]\\n{text}"
            except Exception as e:
                print(f"Failed to fetch company context: {e}")
                updates["company_context"] = "검색 실패"

        # 2. Resume RAG 
        if not state.get("resume_context") and state.get("resume_id"):
            updates["resume_context"] = "정보 검색 실패"
            try:
                import grpc
                from generated.resume.v1 import resume_pb2, resume_pb2_grpc
                from config import RESUME_SERVICE_HOST, RESUME_SERVICE_PORT
                
                channel = grpc.insecure_channel(f"{RESUME_SERVICE_HOST}:{RESUME_SERVICE_PORT}")
                stub = resume_pb2_grpc.ResumeServiceStub(channel)
                
                req = resume_pb2.GetResumeChunksRequest(
                    resume_id=state["resume_id"],
                    limit=5
                )
                res = stub.GetResumeChunks(req)
                if res and res.chunks:
                    text = "\n".join(res.chunks)
                    updates["resume_context"] = f"[이력서 참고 정보]\n{text}"
                else:
                    updates["resume_context"] = "이력서 내용 없음"
                channel.close()
            except Exception as e:
                print(f"Failed to fetch resume context via gRPC: {e}")
                
        # 3. Fetch Self Intro Text from Redis
        if not state.get("self_intro_text") and state.get("interview_id"):
            try:
                import redis
                from config import REDIS_TRACK2_URL
                r = redis.Redis.from_url(REDIS_TRACK2_URL)
                val = r.hget(f"interview:{state['interview_id']}:state", "selfIntroText")
                if val:
                    updates["self_intro_text"] = val.decode('utf-8')
            except Exception as e:
                print(f"Failed to fetch self intro from Redis: {e}")

        return updates

    def time_check(self, state: InterviewState) -> Dict:
        """
        1. Check remaining time.
        2. If time is up, force closing.
        """
        remaining = state.get("remaining_time", 0)
        stage = state.get("stage")
        
        # Dont force close during INTRO stages
        if remaining <= 0 and stage not in ["INTERVIEWER_INTRO", "SELF_INTRO_PROMPT", "WAITING"]:
            return {
                "is_ending": True,
                "next_speaker_id": "CLOSING",
                "reduce_total_time": False,
                "next_difficulty": state.get("current_difficulty", 3)
            }
        
        return {
            "is_ending": False,
            "reduce_total_time": False
        }

    def analyze(self, state: InterviewState) -> Dict:
        """
        Analyze user input to adjust difficulty and time.
        """
        if state.get("is_ending"):
             return {} # Skip if ending
             
        # Skip analysis for intro stages
        if state.get("stage") in ["INTERVIEWER_INTRO", "GREETING", "SELF_INTRO_PROMPT"]:
            return {
                "next_difficulty": state.get("current_difficulty", 3),
                "reduce_total_time": False
            }

        user_input = state.get("user_input", "")
        if not user_input:
             return {
                "analysis_result": {"follow_up_needed": False},
                "next_difficulty": state.get("current_difficulty", 3)
            }

        try:
            analysis = self.analyzer_chain.invoke({
                "question": state["history"][-1].content if state["history"] else "No question",
                "answer": user_input
            })
        except Exception:
            analysis = {
                "understanding_score": 50,
                "is_off_topic": False, 
                "suggested_difficulty_adjustment": 0,
                "follow_up_needed": False
            }

        # Calculate next difficulty
        current_diff = state.get("current_difficulty", 3)
        adjustment = analysis.get("suggested_difficulty_adjustment", 0)
        next_diff = max(1, min(5, current_diff + adjustment))
        
        # Reduce time if difficulty drops
        reduce_time = (adjustment < 0)

        return {
            "analysis_result": analysis,
            "next_difficulty": next_diff,
            "reduce_total_time": reduce_time
        }

    def router(self, state: InterviewState) -> Dict:
        """
        Select next speaker.
        """
        if state.get("is_ending"):
            return {"next_speaker_id": "CLOSING"}

        # Force specific logic for INTRO stages (순차 자기소개)
        stage = state.get("stage", "")
        roles = state.get("available_roles", [])

        if stage == "INTERVIEWER_INTRO":
            # Core가 INTERVIEWER_INTRO에서는 항상 현재 소개할 1명의 역할만 넘기도록 설계되어 있으므로,
            # 여기서는 전달받은 역할 중 첫 번째만 그대로 사용한다.
            if roles:
                return {"next_speaker_id": roles[0]}

        analysis = state.get("analysis_result", {})
        last_id = state.get("last_interviewer_id")
        
        if not roles:
            # Fallback
            return {"next_speaker_id": "TECH"}

        # 1. Follow-up Logic
        if analysis.get("follow_up_needed", False) and last_id:
             if last_id in roles:
                 return {"next_speaker_id": last_id}

        # 2. Random Selection (with bias against repeating same speaker if possible)
        candidates = [r for r in roles]
        if len(candidates) > 1 and last_id:
             others = [r for r in candidates if r != last_id]
             if others:
                 return {"next_speaker_id": random.choice(others)}
        
        return {"next_speaker_id": random.choice(candidates)}

    def summarize_memory(self, state: InterviewState) -> Dict:
        """
        Rolling Window Memory: Summarize old messages if history exceeds 15.
        """
        history = state.get("history", [])
        if len(history) <= 15:
            return {}
            
        # Summarize the first 10 messages
        old_messages = history[:10]
        recent_messages = history[10:]
        
        try:
            from langchain_core.messages import SystemMessage, RemoveMessage
            summary_prompt = """
다음 대화 내용을 바탕으로 [이력 정보 및 답변 내용]을 누적 요약 및 구조화하라.
기존 요약본이 있다면 이를 계승하여 업데이트하라.

[출력 양식]
1. ✅ [지금까지 질문한 주제 목록] (중복 질문 방지용)
- 질문/주제 1: ...

2. 📝 [지원자 답변 팩트 프로필] (거짓말 탐지용 - 지원자가 진술한 팩트 관계만 추출)
- 팩트 1: (예: Java 17 경험 1년)

3. ⚠️ [답변 상호 모순 및 특이사항] (이전 주장과 불일치하거나 진위 확인이 필요하면 코멘트)
- 점검 포인트 1: ...

현재 누적 대화 이력:
"""
            for m in old_messages:
                summary_prompt += f"{m.type}: {m.content}\n"
                
            summary = self.llm.invoke(summary_prompt).content
            
            # RemoveMessage for the ones we want to delete, add the summarized one
            deletes = [RemoveMessage(id=m.id) for m in old_messages if m.id]
            adds = [SystemMessage(content=f"[이전 대화 요약]\\n{summary}")]
            return {"history": deletes + adds}
            
        except Exception as e:
            print(f"Failed to summarize: {e}")
            return {}

    async def generate(self, state: InterviewState):
        """
        Generate response.
        """
        pass

    def get_prompt_messages(self, state: InterviewState) -> List[BaseMessage]:
        speaker_id = state.get("next_speaker_id", "TECH")
        personality_key = state.get("personality", "COMFORTABLE")
        
        # 1. Base Role Prompt
        if speaker_id == "CLOSING":
             role_prompt = ROLE_PROMPTS["CLOSING"]
             # Personality matters less for closing, but we can respect tone if needed.
             # Generally closing is fixed.
             personality_prompt = "" 
        else:
             role_prompt = ROLE_PROMPTS.get(speaker_id, ROLE_PROMPTS["TECH"]) # Default to TECH
             personality_prompt = PERSONALITY_PROMPTS.get(personality_key, PERSONALITY_PROMPTS["COMFORTABLE"])

        # 2. Variable Injection
        system_text = f"{role_prompt}\n{personality_prompt}\n{COMMON_INSTRUCTION}"
        
        try:
            # Some roles might not have placeholders, safe formatting
            system_text = system_text.format(
                remaining_time=state.get("remaining_time"),
                difficulty_level=state.get("next_difficulty", 3)
            )
        except KeyError:
            pass # Format keys might be missing in CLOSING or others, ignore

        # 3. Context Injection (Company & Resume)
        context_block = ""
        comp_ctx = state.get("company_context", "")
        if comp_ctx and comp_ctx != "검색 실패":
            context_block += f"\\n{comp_ctx}"
            
        res_ctx = state.get("resume_context", "")
        if res_ctx and res_ctx != "정보 없음":
            context_block += f"\\n{res_ctx}"
            
        self_intro = state.get("self_intro_text", "")
        if self_intro:
            context_block += f"\\n[지원자 자기소개]\\n{self_intro}"
            
        if context_block:
            system_text += f"\\n\\n[사전 컨텍스트 정보]{context_block}"

        # 4. Stage Instruction
        stage = state.get("stage", "")
        stage_instruction = STAGE_INSTRUCTIONS.get(stage, "")
        if stage_instruction:
            system_text += f"\\n\\n[현재 단계 가이드]\\n{stage_instruction}"
        
        messages = [SystemMessage(content=system_text)] + state.get("history", [])
        if state.get("user_input"):
             input_role = state.get("input_role", "user")
             if input_role == "system":
                 messages.append(SystemMessage(content=state["user_input"]))
             else:
                 messages.append(HumanMessage(content=state["user_input"]))
             
        return messages
