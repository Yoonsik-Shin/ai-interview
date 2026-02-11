import asyncio
import edge_tts
import os

output_dir = "frontend/public/audio/greeting"
os.makedirs(output_dir, exist_ok=True)

# 공통 인사
common_intro = "안녕하세요 면접자님 만나서 반갑습니다."

# 페르소나별 멘트
txt_comfortable = common_intro + " 오늘 면접은 편안한 분위기에서 진행될 예정이니 너무 긴장하지 마시고 편하게 말씀해주세요."
txt_pressure = common_intro + " 오늘 면접은 다소 심도 있는 질문들이 오고 갈 수 있으니, 답변하실 때 신중하게 생각하고 답변해주시기 바랍니다."
txt_random = txt_comfortable # Random은 편안하게

configs = [
    # COMFORTABLE (여성, SunHi)
    {"persona": "COMFORTABLE", "engine": "edge", "voice": "ko-KR-SunHiNeural", "text": txt_comfortable},
    {"persona": "COMFORTABLE", "engine": "openai", "voice": "ko-KR-SunHiNeural", "text": txt_comfortable},
    # PRESSURE (남성, InJoon)
    {"persona": "PRESSURE", "engine": "edge", "voice": "ko-KR-InJoonNeural", "text": txt_pressure},
    {"persona": "PRESSURE", "engine": "openai", "voice": "ko-KR-InJoonNeural", "text": txt_pressure},
    # RANDOM (여성, SunHi)
    {"persona": "RANDOM", "engine": "edge", "voice": "ko-KR-SunHiNeural", "text": txt_random},
    {"persona": "RANDOM", "engine": "openai", "voice": "ko-KR-SunHiNeural", "text": txt_random},
    # 추가: Random인데 Pressure일 수도 있으므로... 뭐 일단 Random은 Default로 감.
]

async def main():
    for config in configs:
        filename = f"{output_dir}/greeting_{config['persona']}_{config['engine']}.mp3"
        communicate = edge_tts.Communicate(config['text'], config['voice'])
        await communicate.save(filename)
        print(f"Generated: {filename}")

if __name__ == "__main__":
    asyncio.run(main())
