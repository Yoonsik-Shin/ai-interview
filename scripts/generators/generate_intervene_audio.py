import asyncio
import edge_tts
import os

async def generate_intervene_audio(text, output_file, voice):
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_file)
    print(f"Generated: {output_file}")

async def main():
    base_dir = "frontend/public/audio/guide"
    os.makedirs(base_dir, exist_ok=True)
    
    # 멘트: "감사합니다. 충분히 들었습니다. 이제 본격적으로 면접을 시작하겠습니다."
    text = "감사합니다. 충분히 들었습니다. 이제 본격적으로 면접을 시작하겠습니다."

    # Voices
    voice_comfortable = "ko-KR-SunHiNeural"
    voice_pressure = "ko-KR-InJoonNeural"
    
    tasks = []
    
    # COMFORTABLE
    tasks.append(generate_intervene_audio(text, f"{base_dir}/intervene_intro_COMFORTABLE_edge.mp3", voice_comfortable))
    
    # PRESSURE
    tasks.append(generate_intervene_audio(text, f"{base_dir}/intervene_intro_PRESSURE_edge.mp3", voice_pressure))
    
    # RANDOM
    tasks.append(generate_intervene_audio(text, f"{base_dir}/intervene_intro_RANDOM_edge.mp3", voice_comfortable))

    await asyncio.gather(*tasks)

if __name__ == "__main__":
    asyncio.run(main())
