from typing import Optional
from io import BytesIO
from datetime import datetime
import boto3
from botocore.client import Config

from utils.log_format import log_json


class ObjectStorageEngine:
    """S3-compatible Object Storage client wrapper for OCI/MinIO"""

    def __init__(
        self,
        endpoint: str,
        access_key: str,
        secret_key: str,
        bucket: str,
        region: str = "ap-seoul-1",
    ):
        self.bucket = bucket
        self.endpoint = endpoint
        self.client = None

        if endpoint and access_key and secret_key:
            try:
                self.client = boto3.client(
                    "s3",
                    endpoint_url=endpoint,
                    aws_access_key_id=access_key,
                    aws_secret_access_key=secret_key,
                    region_name=region,
                    config=Config(signature_version="s3v4"),
                )
                # Verify bucket exists
                self.client.head_bucket(Bucket=bucket)
                log_json("s3_connected", bucket=bucket, endpoint=endpoint)
            except Exception as e:
                log_json("s3_connection_failed", error=str(e), bucket=bucket)
                raise

    def upload_file(
        self, interview_id: int, user_id: int, audio_data: bytes, metadata: dict
    ) -> Optional[str]:
        """
        Upload audio file to Object Storage

        Args:
            interview_id: Interview ID
            user_id: User ID
            audio_data: Complete audio binary data
            metadata: Metadata (sample_rate, channels, format, etc.)

        Returns:
            URL of the uploaded object, or None if upload failed
        """
        if not self.client:
            log_json("s3_client_not_initialized")
            return None

        try:
            # Generate object key: interviews/{user_id}/{interview_id}/{timestamp}.{format}
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_format = metadata.get("format", "webm")
            object_key = f"interviews/{user_id}/{interview_id}/{timestamp}.{file_format}"

            # Prepare S3 metadata
            s3_metadata = {
                "interview-id": str(interview_id),
                "user-id": str(user_id),
                "sample-rate": str(metadata.get("sample_rate", 16000)),
                "channels": str(metadata.get("channels", 1)),
                "uploaded-at": datetime.now().isoformat(),
            }

            # Upload
            file_obj = BytesIO(audio_data)
            self.client.upload_fileobj(
                file_obj, self.bucket, object_key, ExtraArgs={"Metadata": s3_metadata}
            )

            # Generate URL
            object_url = f"{self.endpoint}/{self.bucket}/{object_key}"

            log_json(
                "file_uploaded",
                interview_id=interview_id,
                object_key=object_key,
                size_bytes=len(audio_data),
            )

            return object_url

        except Exception as e:
            log_json("file_upload_failed", interview_id=interview_id, error=str(e))
            return None
