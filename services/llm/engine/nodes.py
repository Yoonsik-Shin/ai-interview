

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

        # 3. Stage Instruction
        stage = state.get("stage", "")
        stage_instruction = STAGE_INSTRUCTIONS.get(stage, "")
        if stage_instruction:
            system_text += f"\n\n[현재 단계 가이드]\n{stage_instruction}"
        
        messages = [SystemMessage(content=system_text)] + state.get("history", [])
        if state.get("user_input"):
             input_role = state.get("input_role", "user")
             if input_role == "system":
                 messages.append(SystemMessage(content=state["user_input"]))
             else:
                 messages.append(HumanMessage(content=state["user_input"]))
             
        return messages
