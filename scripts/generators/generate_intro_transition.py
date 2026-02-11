import asyncio
import edge_tts
import os

async def generate_transition_audio(text, output_file, voice):
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_file)
    print(f"Generated: {output_file}")

async def main():
    base_dir = "frontend/public/audio/guide"
    os.makedirs(base_dir, exist_ok=True)
    
    # 멘트: "자기소개 잘 들었습니다. 자기소개와 이력서 기반으로 질문 드리겠습니다."
    text_comfortable = "자기소개 잘 들었습니다. 자기소개와 이력서 기반으로 질문 드리겠습니다."
    text_pressure = "자기소개 잘 들었습니다. 자기소개와 이력서 기반으로 질문 드리겠습니다." # 멘트는 동일하지만 톤이 다를 수 있음 (여기선 텍스트 동일)

    # Voices
    voice_comfortable = "ko-KR-SunHiNeural"
    voice_pressure = "ko-KR-InJoonNeural"
    
    # Filenames: transition_intro_{persona}_{engine}.mp3
    # Engine: edge (openai는 API 필요하므로 edge로 통일하거나 추후 추가)
    
    tasks = []
    
    # COMFORTABLE (Example Voice)
    tasks.append(generate_transition_audio(text_comfortable, f"{base_dir}/transition_intro_COMFORTABLE_edge.mp3", voice_comfortable))
    
    # PRESSURE
    tasks.append(generate_transition_audio(text_pressure, f"{base_dir}/transition_intro_PRESSURE_edge.mp3", voice_pressure))
    
    # RANDOM (Fallback to Comfortable)
    tasks.append(generate_transition_audio(text_comfortable, f"{base_dir}/transition_intro_RANDOM_edge.mp3", voice_comfortable))

    await asyncio.gather(*tasks)

if __name__ == "__main__":
    asyncio.run(main())
