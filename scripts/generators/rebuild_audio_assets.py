import asyncio
import os
import sys

# Add services/infra/tts to path to import engine and config
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../services/infra/tts")))

from engine.edge_tts_engine import synthesize_edge
from config import EDGE_CUSTOM_SETTINGS

OUTPUT_BASE_DIR = "Frontend/public/audio"

def get_texts(persona):
    return {
        'greeting': {
            'greeting': "안녕하세요 면접자님 만나서 반갑습니다.",
        },
        'guide': {
            'intervene_intro': "감사합니다. 충분히 들었습니다. 시간 관계상 바로 다음으로 넘어가도록 하겠습니다.",
            'transition_intro': "좋습니다. 자기소개 잘 들었습니다. 이제 본격적으로 면접을 시작하겠습니다."
        },
        'prompt': {
            'interviewer_intro': "네 반갑습니다. 지금부터 참여해주신 면접관님들께서 간단한 자기소개를 진행해주시겠습니다.",
            'intro_self': {
                'MAIN': "안녕하세요. 저는 리드 면접관입니다. 오늘 전체적인 면접 흐름을 이끌어갈 예정입니다.",
                'HR': "안녕하세요. 저는 인사 부문을 담당하고 있는 면접관입니다. 조직 문화와 가치관 적합성을 집중적으로 확인하겠습니다.",
                'TECH': "안녕하세요. 저는 기술 면접관입니다. 실무 역량과 기술적 깊이를 위주로 대화를 나누고 싶습니다.",
                'EXEC': "안녕하세요. 저는 임원 면접관입니다. 비즈니스 통찰력과 장기적인 성장 가능성을 검토하도록 하겠습니다."
            }.get(persona, "안녕하세요. 저는 면접관입니다. 잘 부탁드립니다."),
            'last_question': "마지막으로 저희에게 궁금한 점이나 하고 싶은 말씀 있으신가요?",
            'self_intro': "지금부터 약 1분간 자기소개를 진행 부탁드립니다."
        },
        'closing': {
            'closing': "수고 많으셨습니다. 오늘 면접은 여기서 마치도록 하겠습니다. 감사합니다."
        },
        'feedback': {
            'please_repeat': "죄송하지만 다시 한번 말씀해 주시겠어요?",
            'retry_short': "답변이 너무 짧습니다. 내용을 조금 더 구체적으로 말씀해 주시겠어요?"
        },
        'fillers': {
            'ack_long': "아 그렇군요. 잘 알겠습니다.",
            'ack_short': "네 알겠습니다.",
            'next_q': "그렇군요. 그럼 다음 질문 드리겠습니다.",
            'thanks': "답변 감사합니다.",
        }
    }

async def generate_asset(persona, category, action, text):
    settings = EDGE_CUSTOM_SETTINGS.get(persona, EDGE_CUSTOM_SETTINGS['MAIN'])
    
    # New Folder Structure: /audio/{PERSONA}/{category}/{action}_edge.mp3
    target_dir = os.path.join(OUTPUT_BASE_DIR, persona, category)
    os.makedirs(target_dir, exist_ok=True)
    
    filename = f"{action}_edge.mp3"
    filepath = os.path.join(target_dir, filename)
    
    print(f"Generating [{persona}] {category}/{action}...")
    try:
        audio_bytes = await synthesize_edge(
            text, 
            persona, 
            rate=settings.get('rate'), 
            pitch=settings.get('pitch')
        )
        with open(filepath, "wb") as f:
            f.write(audio_bytes)
    except Exception as e:
        print(f"Failed to generate {filepath}: {e}")

async def main():
    personas = ['MAIN', 'HR', 'TECH', 'EXEC']
    
    tasks = []
    for persona in personas:
        categories = get_texts(persona)
        for category, actions in categories.items():
            for action, text in actions.items():
                tasks.append(generate_asset(persona, category, action, text))
    
    await asyncio.gather(*tasks)
    print("\nAll assets generated successfully!")

if __name__ == "__main__":
    asyncio.run(main())
