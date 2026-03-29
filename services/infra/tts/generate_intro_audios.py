import asyncio
import os
import edge_tts

# 설정
VOICE_MAP = {
    'MAIN': 'ko-KR-SunHiNeural',
    'LEADER': 'ko-KR-SunHiNeural',
    'TECH': 'ko-KR-InJoonNeural',
    'HR': 'ko-KR-SunHiNeural',
    'EXEC': 'ko-KR-HyunsuMultilingualNeural',
    'PRESSURE': 'ko-KR-InJoonNeural',
    'COMFORTABLE': 'ko-KR-SunHiNeural',
    'RANDOM': 'ko-KR-HyunsuMultilingualNeural',
}

INTRO_TEXT = "네 반갑습니다. 지금부터 참여해주신 면접관님들께서 간단한 자기소개를 진행해주시겠습니다."

OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../frontend/public/audio/prompt'))

async def generate_intro(persona, text, voice):
    output_path = os.path.join(OUTPUT_DIR, f'interviewer_intro_{persona}_edge.mp3')
    print(f"Generating {output_path}...")
    
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)
    print(f"Finished {persona}")

async def main():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    tasks = []
    # 중복 제거 (MAIN=LEADER 등)
    distinct_personas = {
        'MAIN': VOICE_MAP['MAIN'],
        'LEADER': VOICE_MAP['LEADER'],
        'TECH': VOICE_MAP['TECH'],
        'HR': VOICE_MAP['HR'],
        'EXEC': VOICE_MAP['EXEC'],
        'PRESSURE': VOICE_MAP['PRESSURE'],
        'COMFORTABLE': VOICE_MAP['COMFORTABLE'],
        'RANDOM': VOICE_MAP['RANDOM'],
    }
    
    for persona, voice in distinct_personas.items():
        tasks.append(generate_intro(persona, INTRO_TEXT, voice))
    
    await asyncio.gather(*tasks)

if __name__ == "__main__":
    asyncio.run(main())
