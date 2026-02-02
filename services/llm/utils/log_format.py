import json
from datetime import datetime


def log_json(event: str, **fields) -> None:
    """
    JSON 포맷으로 표준화된 로그를 출력합니다.
    """
    base = {
        "service": "llm",
        "event": event,
        "timestamp": datetime.now().isoformat(),
    }
    base.update(fields)
    print(json.dumps(base, ensure_ascii=False), flush=True)
