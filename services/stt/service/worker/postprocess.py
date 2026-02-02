"""음성 인식 결과 텍스트 후처리."""


def postprocess_text(text: str) -> str:
    """
    공백 정규화 및 앞뒤 공백 제거
    """
    return " ".join(text.split()).strip()
