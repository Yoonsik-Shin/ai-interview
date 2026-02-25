from typing import Optional
from io import BytesIO
from datetime import datetime
from urllib.parse import urlparse, urlunparse
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
        public_endpoint: str = "",
    ):
        self.bucket = bucket
        self.endpoint = endpoint
        self.public_endpoint = public_endpoint
        self.client = None
        self.presigned_client = None

        if endpoint and access_key and secret_key:
            try:
                s3_config = Config(
                    signature_version="s3v4",
                    s3={'addressing_style': 'path'}
                )
                
                self.client = boto3.client(
                    "s3",
                    endpoint_url=endpoint,
                    aws_access_key_id=access_key,
                    aws_secret_access_key=secret_key,
                    region_name=region,
                    config=s3_config,
                )
                
                # Dedicated client for presigned URLs uses the public endpoint
                # to ensure the Host header in the signature matches external access.
                self.presigned_client = boto3.client(
                    "s3",
                    endpoint_url=public_endpoint if public_endpoint else endpoint,
                    aws_access_key_id=access_key,
                    aws_secret_access_key=secret_key,
                    region_name=region,
                    config=s3_config,
                )
                
                # Verify bucket exists (using internal client)
                self.client.head_bucket(Bucket=bucket)
                log_json("s3_connected", bucket=bucket, endpoint=endpoint, public_endpoint=public_endpoint)
            except Exception as e:
                log_json("s3_connection_failed", error=str(e), bucket=bucket)
                raise

    def upload_file(
        self, interview_id: str, user_id: str, audio_data: bytes, metadata: dict
    ) -> Optional[tuple[str, str]]:
        """
        Upload audio file to Object Storage

        Args:
            interview_id: Interview ID
            user_id: User ID
            audio_data: Complete audio binary data
            metadata: Metadata (sample_rate, channels, format, etc.)

        Returns:
            Tuple of (URL, Key) of the uploaded object, or None if upload failed
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

            return object_url, object_key

        except Exception as e:
            log_json("file_upload_failed", interview_id=interview_id, error=str(e))
            return None

    def generate_presigned_url(self, object_key: str, method: str = "get_object", expiration: int = 3600, internal_access: bool = False) -> Optional[str]:
        """
        Generate a presigned URL for an object

        Args:
            object_key: S3 object key
            method: S3 client method (e.g., 'get_object' for download, 'put_object' for upload)
            expiration: URL expiration time in seconds (default 1 hour)
            internal_access: If True, returns a URL usable within the cluster (minio.unbrdn...), otherwise public (minio.localhost)

        Returns:
            Presigned URL string, or None if generation failed
        """
        if not self.client:
            log_json("s3_client_not_initialized")
            return None

        try:
            # Select client based on access type
            # internal_access=True -> Use self.client (Internal Endpoint)
            # internal_access=False -> Use self.presigned_client (Public Endpoint)
            # Note: self.presigned_client might be None if public_endpoint wasn't provided, fallback to self.client
            
            client_to_use = self.client
            if not internal_access and self.presigned_client:
                client_to_use = self.presigned_client
            
            url = client_to_use.generate_presigned_url(
                method,
                Params={"Bucket": self.bucket, "Key": object_key},
                ExpiresIn=expiration,
            )
            
            log_json("presigned_url_generated", object_key=object_key, url=url, internal=internal_access)
            return url
        except Exception as e:
            log_json("presigned_url_generation_failed", object_key=object_key, error=str(e))
            return None
