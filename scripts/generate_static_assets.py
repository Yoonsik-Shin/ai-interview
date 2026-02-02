import sys
import os
import asyncio
import argparse

# Add services/tts to path so we can import engine
sys.path.append(os.path.abspath("services/tts"))

from engine.openai_engine import synthesize_openai
from engine.edge_tts_engine import synthesize_edge
from config import OPENAI_VOICE_MAP, EDGE_VOICE_MAP

ASSETS = {
    "greeting": {
        "text_default": "안녕하세요, 면접관입니다. 본격적인 면접에 앞서, 1분간 자기소개를 부탁드립니다.",
        "text_COMFORTABLE": "안녕하세요, 면접관입니다. 편안한 분위기에서 진행할 예정이니 긴장하지 마시고, 1분간 자기소개를 부탁드립니다.",
        "text_PRESSURE": "안녕하십니까. 면접관입니다. 본격적인 검증에 앞서, 1분간 자기소개를 실시해주십시오. 핵심만 간결하게 말씀해 주세요."
    },
    "please_repeat": {
        "text_default": "죄송하지만, 다시 한번 말씀해 주시겠어요?",
        "text_COMFORTABLE": "죄송해요, 잘 못 들었어요. 다시 한 번 말씀해 주시겠어요?",
        "text_PRESSURE": "잘 들리지 않았습니다. 다시 말씀해 주십시오."
    },
    "fillers": {
        "ack_short": "네.",
        "ack_long": "네, 알겠습니다.",
        "wait": "잠시만 기다려주세요.",
        "thanks": "답변 감사합니다.",
        "next_q": "다음 질문 드리겠습니다."
    }
}

async def generate_assets(engine_name="openai"):
    output_dir = "frontend/public/audio/fillers"
    greeting_dir = "frontend/public/audio"
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(greeting_dir, exist_ok=True)

    print(f"🚀 Generating assets using engine: {engine_name}")

    personas = OPENAI_VOICE_MAP.keys() if engine_name == "openai" else EDGE_VOICE_MAP.keys()

    for persona in personas:
        print(f"\n👤 Processing Persona: {persona}")
        
        # 1. Generate Greeting
        text = ASSETS["greeting"].get(f"text_{persona}", ASSETS["greeting"]["text_default"])
        # Filename format: greeting_{persona}_{engine}.mp3
        filename = f"greeting_{persona}_{engine_name}.mp3"
        path = os.path.join(greeting_dir, filename)
        
        await generate_file(text, persona, path, engine_name)

        # 1.5 Generate Please Repeat
        text_repeat = ASSETS["please_repeat"].get(f"text_{persona}", ASSETS["please_repeat"]["text_default"])
        filename_repeat = f"please_repeat_{persona}_{engine_name}.mp3"
        path_repeat = os.path.join(greeting_dir, filename_repeat)
        await generate_file(text_repeat, persona, path_repeat, engine_name)

        # 2. Generate Fillers
        for key, filler_text in ASSETS["fillers"].items():
            # Filename format: {persona}_{key}_{engine}.mp3
            filename = f"{persona}_{key}_{engine_name}.mp3"
            path = os.path.join(output_dir, filename)
            await generate_file(filler_text, persona, path, engine_name)

async def generate_file(text, persona, path, engine_name):
    try:
        if engine_name == "openai":
            # OpenAI is sync in the engine wrapper
            audio_data = synthesize_openai(text, persona)
        else:
            # Edge TTS is async
            audio_data = await synthesize_edge(text, persona)
            
        with open(path, "wb") as f:
            f.write(audio_data)
        print(f"  ✅ Saved: {path}")
    except Exception as e:
        print(f"  ❌ Failed ({path}): {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--engine", choices=["openai", "edge"], default="openai", help="TTS Engine to use")
    args = parser.parse_args()

    asyncio.run(generate_assets(args.engine))
