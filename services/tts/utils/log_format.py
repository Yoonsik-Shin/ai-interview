import json
from datetime import datetime


def log_json(event: str, **fields) -> None:
    payload = {
        "service": "tts",
        "event": event,
        "timestamp": datetime.now().isoformat(),
    }
    payload.update(fields)
    print(json.dumps(payload, ensure_ascii=False), flush=True)
