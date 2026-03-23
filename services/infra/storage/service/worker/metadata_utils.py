from typing import Dict


def extract_metadata(message: dict) -> Dict:
    """
    Extract and validate metadata from queue message

    Args:
        message: Queue message containing metadata

    Returns:
        Extracted metadata dictionary
    """
    metadata = message.get("metadata", {})

    # Set defaults if not provided
    if "sample_rate" not in metadata:
        metadata["sample_rate"] = 16000
    if "channels" not in metadata:
        metadata["channels"] = 1
    if "format" not in metadata:
        metadata["format"] = "webm"

    return metadata


def build_s3_metadata(interview_id: int, user_id: int, metadata: dict) -> Dict[str, str]:
    """
    Build S3 metadata for object upload

    Args:
        interview_id: Interview ID
        user_id: User ID
        metadata: File metadata

    Returns:
        S3-compatible metadata dictionary (all values as strings)
    """
    from datetime import datetime

    return {
        "interview-id": str(interview_id),
        "user-id": str(user_id),
        "sample-rate": str(metadata.get("sample_rate", 16000)),
        "channels": str(metadata.get("channels", 1)),
        "uploaded-at": datetime.now().isoformat(),
    }


def generate_object_key(interview_id: int, user_id: int, file_format: str = "webm") -> str:
    """
    Generate object key for storage

    Args:
        interview_id: Interview ID
        user_id: User ID
        file_format: File format extension

    Returns:
        Object key path
    """
    from datetime import datetime

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"interviews/{user_id}/{interview_id}/{timestamp}.{file_format}"
