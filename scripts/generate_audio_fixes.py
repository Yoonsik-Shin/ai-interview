import asyncio
import os
import sys
from openai import OpenAI
import edge_tts

# --- Configuration ---
OUTPUT_ROOT = "frontend/public/audio"
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

# Persona Definitions
PERSONAS = [
    "COMFORTABLE", "RANDOM", "HR", "MAIN", 
    "PRESSURE", "EXEC", "TECH"
]

# Voice Mapping
# Edge: ko-KR-SunHiNeural (Fem), ko-KR-InJoonNeural (Male)
# OpenAI: shimmer (Fem), onyx (Male)
VOICE_MAP = {
    # Female / Soft
    "COMFORTABLE": {"edge": "ko-KR-SunHiNeural", "openai": "shimmer"},
    "RANDOM":      {"edge": "ko-KR-SunHiNeural", "openai": "shimmer"},
    "HR":          {"edge": "ko-KR-SunHiNeural", "openai": "shimmer"},
    "MAIN":        {"edge": "ko-KR-SunHiNeural", "openai": "shimmer"},
    # Male / Strict
    "PRESSURE":    {"edge": "ko-KR-InJoonNeural", "openai": "onyx"},
    "EXEC":        {"edge": "ko-KR-InJoonNeural", "openai": "onyx"},
    "TECH":        {"edge": "ko-KR-InJoonNeural", "openai": "onyx"},
}

# Content Definitions
# {category}_{filename_suffix} -> Text Content
# Filename pattern: {category}/{action}_{persona}_{engine}.mp3
SCRIPTS = {
    "greeting": {
        "action": "greeting",
        "text": "안녕하십니까, 면접관입니다."
    },
    "prompt": {
        "action": "self_intro_prompt",
        "text": "준비되셨으면, 1분간 자기소개를 해주시기 바랍니다."
    },
    "feedback": {
        "action": "retry_short",
        # 페르소나별 미묘한 말투 차이 반영 가능하지만, 현재는 통일
        "text": "답변이 너무 짧습니다. 내용을 조금 더 구체적으로 말씀해 주시겠어요?"
    }
}

async def generate_edge(text, voice, filepath):
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(filepath)

def generate_openai(client, text, voice, filepath):
    response = client.audio.speech.create(
        model="tts-1",
        voice=voice,
        input=text
    )
    response.stream_to_file(filepath)

async def main():
    print("Starting audio generation...")
    
    # Initialize OpenAI Client
    openai_client = None
    if OPENAI_API_KEY:
        openai_client = OpenAI(api_key=OPENAI_API_KEY)
        print("OpenAI API Key found. Will generate 'openai' engine files.")
    else:
        print("WARNING: OpenAI API Key NOT found.")
        print("Skipping 'openai' generation. Please set OPENAI_API_KEY env var.")

    files_generated = 0

    for category, content in SCRIPTS.items():
        action = content["action"]
        text = content["text"]
        
        output_dir = os.path.join(OUTPUT_ROOT, category)
        os.makedirs(output_dir, exist_ok=True)
        
        for persona in PERSONAS:
            voices = VOICE_MAP.get(persona, VOICE_MAP["COMFORTABLE"]) # Fallback
            
            # 1. Generate Edge
            edge_voice = voices["edge"]
            edge_filename = f"{action}_{persona}_edge.mp3"
            edge_path = os.path.join(output_dir, edge_filename)
            
            print(f"Generating [Edge] {edge_path}...")
            try:
                await generate_edge(text, edge_voice, edge_path)
                files_generated += 1
            except Exception as e:
                print(f"Failed to generate {edge_path}: {e}")

            # 2. Generate OpenAI
            if openai_client:
                openai_voice = voices["openai"]
                openai_filename = f"{action}_{persona}_openai.mp3"
                openai_path = os.path.join(output_dir, openai_filename)
                
                print(f"Generating [OpenAI] {openai_path}...")
                try:
                    # Sync call wrapped in trivial async context for simplicity
                    generate_openai(openai_client, text, openai_voice, openai_path)
                    files_generated += 1
                except Exception as e:
                    print(f"Failed to generate {openai_path}: {e}")
    
    # Cleanup Unused
    print("\nCleaning up unused files...")
    unused_patterns = [
        "prompt/interviewer_intro_*.mp3"
    ]
    # Simple glob removal
    import glob
    for pattern in unused_patterns:
        full_pattern = os.path.join(OUTPUT_ROOT, pattern)
        for f in glob.glob(full_pattern):
            try:
                os.remove(f)
                print(f"Deleted unused: {f}")
            except OSError as e:
                print(f"Error deleting {f}: {e}")

    print(f"\nDone! Generated {files_generated} files.")

if __name__ == "__main__":
    asyncio.run(main())
