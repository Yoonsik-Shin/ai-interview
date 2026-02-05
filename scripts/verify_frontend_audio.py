import os
import sys
from collections import defaultdict
from faster_whisper import WhisperModel

# Configuration
AUDIO_ROOT = "frontend/public/audio"
REPORT_FILE = "frontend_audio_report.txt"
MODEL_SIZE = "medium"  # large-v3, medium, small
DEVICE = "cpu"         # cpu or cuda
COMPUTE_TYPE = "int8"  # int8, float16

def parse_metadata(root, filename):
    # Path: frontend/public/audio/{category}/{filename}
    # Filename: {action}_{persona}_{engine}.mp3
    # Exception: retry_short_{persona}_{engine}
    
    try:
        rel_path = os.path.relpath(os.path.join(root, filename), AUDIO_ROOT)
        parts = rel_path.split(os.sep)
        category = parts[0] if len(parts) > 1 else "root"
        
        name_without_ext = os.path.splitext(filename)[0]
        name_parts = name_without_ext.split("_")
        
        # Heuristic parsing
        # Engine is usually the last part: edge, openai
        # Persona is usually the second to last: COMFORTABLE, EXEC, etc.
        
        engine = name_parts[-1]
        
        # Check if engine is valid (simple check)
        if engine not in ["edge", "openai"]:
            # Maybe interviewer_intro? action_persona.mp3
            engine = "N/A"
            persona = name_parts[-1]
            action = "_".join(name_parts[:-1])
        else:
            persona = name_parts[-2]
            action = "_".join(name_parts[:-2])
            
        return {
            "category": category,
            "action": action,
            "persona": persona,
            "engine": engine,
            "path": rel_path
        }
    except Exception:
        return {
            "category": "unknown",
            "action": filename,
            "persona": "unknown",
            "engine": "unknown",
            "path": filename
        }

def verify_audio():
    print(f"Scanning {AUDIO_ROOT}...", flush=True)
    all_files = []
    for root, dirs, files in os.walk(AUDIO_ROOT):
        for file in files:
            if file.lower().endswith(('.mp3', '.wav')):
                all_files.append(os.path.join(root, file))
    
    total_files = len(all_files)
    print(f"Found {total_files} audio files.", flush=True)

    print(f"Loading Whisper model ({MODEL_SIZE})... (This may take a while if downloading for the first time)", flush=True)
    try:
        model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
    except Exception as e:
        print(f"Error loading model: {e}", flush=True)
        print("Please ensure you are running this in the 'services/stt/.venv' environment.", flush=True)
        return

    results = defaultdict(lambda: defaultdict(list))
    
    print("-" * 50, flush=True)
    
    for idx, full_path in enumerate(sorted(all_files), 1):
        filename = os.path.basename(full_path)
        root = os.path.dirname(full_path)
        
        meta = parse_metadata(root, filename)
        
        # Display progress: [1/75] Processing: category/file.mp3...
        print(f"[{idx}/{total_files}] Processing: {meta['path']}... ", end="", flush=True)
        
        try:
            segments, info = model.transcribe(full_path, beam_size=5)
            text = " ".join([segment.text for segment in segments]).strip()
            duration = info.duration
            
            meta["text"] = text
            meta["duration"] = duration
            
            # Group by Category > Action
            group_key = f"[{meta['category'].upper()}] {meta['action']}"
            results[group_key][meta['persona']].append(meta)
            
            print(f"Done ({duration:.1f}s)", flush=True)
            # Optional: Print preview of text to show it's working
            # print(f"   -> \"{text[:50]}...\"", flush=True)
            
        except Exception as e:
            print(f"Error: {e}", flush=True)
            meta["error"] = str(e)
            results["ERRORS"]["ALL"].append(meta)

    # Generate Report
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        f.write("Frontend Audio Verification Report\n")
        f.write("====================================\n\n")
        
        # Sort by Category/Action
        sorted_groups = sorted(results.keys())
        
        for group in sorted_groups:
            f.write(f"### {group}\n")
            
            personas = results[group]
            for persona in sorted(personas.keys()):
                items = sorted(personas[persona], key=lambda x: x['engine'])
                
                for item in items:
                    engine_tag = f"[{item['engine'].upper()}]"
                    persona_tag = f"({item['persona']})"
                    
                    if "error" in item:
                        f.write(f"- {engine_tag} {persona_tag}: [ERROR] {item['error']}\n")
                    else:
                        f.write(f"- {engine_tag} {persona_tag}: {item['text']} ({item['duration']:.1f}s)\n")
            f.write("\n")

    print(f"\nVerification complete. Report saved to {REPORT_FILE}", flush=True)

if __name__ == "__main__":
    if not os.path.exists(AUDIO_ROOT):
        print(f"Error: Audio root directory '{AUDIO_ROOT}' not found.", flush=True)
        sys.exit(1)
        
    verify_audio()
