import json
import os
from datetime import datetime

LOG_LEVEL = os.getenv("STT_LOG_LEVEL", "info").lower()  # info, debug, trace


def log_json(event: str, level: str = "info", **fields) -> None:
    """
    JSON 포맷 로그 (레벨별 출력)
    level: info(기본), debug, trace
    환경변수 STT_LOG_LEVEL로 출력 제어
    """
    levels = {"info": 1, "debug": 2, "trace": 3}
    current = levels.get(LOG_LEVEL, 1)
    target = levels.get(level, 1)
    if target > current:
        return  # 레벨 미달시 출력 안함
    base = {
        "service": "stt",
        "event": event,
        "level": level,
        "timestamp": datetime.now().isoformat(),
    }
    base.update(fields)
    print(json.dumps(base, ensure_ascii=False), flush=True)
