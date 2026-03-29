import os
import yaml
from langchain_core.prompts import ChatPromptTemplate

PROMPTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prompts")

def load_yaml(filename: str) -> dict:
    filepath = os.path.join(PROMPTS_DIR, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

# Load dicts
ROLE_PROMPTS = load_yaml("roles.yaml")
PERSONALITY_PROMPTS = load_yaml("personalities.yaml")
STAGE_INSTRUCTIONS = load_yaml("stages.yaml")
_common_prompts = load_yaml("common.yaml")

COMMON_INSTRUCTION = _common_prompts.get("COMMON_INSTRUCTION", "")
ANALYZER_SYSTEM_PROMPT = _common_prompts.get("ANALYZER_SYSTEM_PROMPT", "")
ROUND_INSTRUCTIONS = _common_prompts.get("ROUND_INSTRUCTIONS", {})
RESUME_CLASSIFICATION_SYSTEM_PROMPT = _common_prompts.get("RESUME_CLASSIFICATION_SYSTEM_PROMPT", "")

ANALYZER_PROMPT = ChatPromptTemplate.from_messages([
    ("system", ANALYZER_SYSTEM_PROMPT),
    ("user", (
        "Question: {question}\n"
        "Candidate's Answer: {answer}\n\n"
        "Resume Context (empty if not available):\n{resume_context}\n\n"
        "Recent Conversation History (empty if not available):\n{conversation_history}"
    ))
])

RESUME_CLASSIFICATION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", RESUME_CLASSIFICATION_SYSTEM_PROMPT),
    ("user", "Text to classify:\n{text}")
])
