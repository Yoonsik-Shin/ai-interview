import json
from datetime import datetime

def log_json(event: str, **fields) -> None:
    """JSON format logging for structured logs"""
    base = {
        "service": "document",
        "event": event,
        "timestamp": datetime.now().isoformat(),
    }
    base.update(fields)
    print(json.dumps(base, ensure_ascii=False), flush=True)
