
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI

from engine.nodes import InterviewState, InterviewNodes
from langgraph.checkpoint.redis import RedisSaver
import redis
from config import REDIS_TRACK2_URL

def create_interview_graph(model_name: str = "gpt-4o-mini", openai_api_key: str = None):
    llm = ChatOpenAI(model=model_name, api_key=openai_api_key, streaming=True)
    nodes = InterviewNodes(llm)

    workflow = StateGraph(InterviewState)

    # Add Nodes
    workflow.add_node("fetch_context", nodes.fetch_context)
    workflow.add_node("summarize_memory", nodes.summarize_memory)
    workflow.add_node("time_check", nodes.time_check)
    workflow.add_node("analyze", nodes.analyze)
    workflow.add_node("router", nodes.router)
    
    # We define generate as a node that updates state, but for actual streaming
    # we might handle it differently. Here we just set up dependencies.
    # Actually for streaming response, we can have the generate node return the prompt messages
    # and let the runner execute LLM. Or we can have generate node execute LLM.
    # Let's keep it simple: Identify WHO speaks. The actual generation happens in the gRPC handler
    # consuming the state.
    # WAIT, the requirement is "LLM -> Core (Stream)".
    # If we run the graph, we want to stream the output of the "generate" step.
    
    # Let's just have the graph determine the speaker and parameters.
    # The generation can be the last step.
    
    # Define Edges
    workflow.set_entry_point("fetch_context")
    workflow.add_edge("fetch_context", "summarize_memory")
    workflow.add_edge("summarize_memory", "time_check")

    def time_check_condition(state):
        if state.get("is_ending"):
            return "generate_closing"
        return "analyze"

    workflow.add_conditional_edges(
        "time_check",
        time_check_condition,
        {
            "generate_closing": END, # We stop here and let caller handle generation for CLOSING
            "analyze": "analyze"
        }
    )

    workflow.add_edge("analyze", "router")
    workflow.add_edge("router", END) 
    
    # Logic:
    # 1. Run graph until END.
    # 2. State at END has `next_speaker_id`, `next_difficulty`, `is_ending`.
    # 3. Request Handler uses `nodes.get_prompt_messages(state)` to get messages.
    # 4. Handler calls LLM.stream(messages).
    
    # Setup Track 2 Checkpointer
    redis_conn = redis.Redis.from_url(REDIS_TRACK2_URL)
    saver = RedisSaver(redis_client=redis_conn)
    
    # [근본 해결] 애플리케이션 시작 시 Redis Search Index 자동 생성 실행
    try:
        saver.setup()
    except Exception as e:
        # 이미 인덱스가 생성되었거나 기타 충돌 발생 시 무시
        print(f"Index creation skipped/exists: {e}")
    
    return workflow.compile(checkpointer=saver)
