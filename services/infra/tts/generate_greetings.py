import asyncio
import os
import edge_tts

# 설정
VOICE_MAP = {
    'PRESSURE': 'ko-KR-SunHiNeural',
    'COMFORTABLE': 'ko-KR-SunHiNeural',
    'RANDOM': 'ko-KR-InJoonNeural',
}

GREETINGS = {
    'PRESSURE': "반갑습니다. 오늘 면접을 진행하게 된 면접관입니다. 바로 본론으로 들어가죠. 시간 낭비 없이, 먼저 준비하신 자기소개 부탁드립니다.",
    'COMFORTABLE': "안녕하세요! 만나서 정말 반가워요. 오늘 면접은 편안한 분위기에서 여러분의 강점을 알아가는 자리입니다. 너무 긴장하지 마시고요. 준비되셨으면 자기소개부터 천천히 시작해 볼까요?",
    'RANDOM': "안녕하세요. 오늘 면접을 담당하게 되었습니다. 지원해 주셔서 감사합니다. 면접을 시작하기 앞서, 간단하게 자기소개 먼저 부탁드려도 될까요?",
}

OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend/public/audio'))

async def generate_greeting(persona, text, voice):
    output_path = os.path.join(OUTPUT_DIR, f'greeting_{persona}_edge.mp3')
    print(f"Generating {output_path}...")
    
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)
    print(f"Finished {persona}")

async def main():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    tasks = []
    for persona, text in GREETINGS.items():
        voice = VOICE_MAP[persona]
        tasks.append(generate_greeting(persona, text, voice))
    
    await asyncio.gather(*tasks)

if __name__ == "__main__":
    asyncio.run(main())
