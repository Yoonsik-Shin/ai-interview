import time
import redis

import config
from utils.log_format import log_json
from engine.object_storage import ObjectStorageEngine
from event.consumer import init_redis_client
from service.worker.queue_processor import process_audio_queue


class StorageService:
    """Main storage service orchestrator"""

    def __init__(self):
        self.redis_client: redis.Redis = None
        self.storage_engine: ObjectStorageEngine = None
        self.running = False

    def initialize(self):
        """Initialize all service components"""
        log_json("storage_service_initializing")

        # Initialize Redis
        self.redis_client = init_redis_client(
            host=config.REDIS_HOST,
            port=config.REDIS_PORT,
            db=config.REDIS_DB,
            password=config.REDIS_PASSWORD,
            sentinel_hosts_env=config.REDIS_SENTINEL_HOSTS,
            sentinel_host_env=config.REDIS_SENTINEL_HOST,
            sentinel_port=config.REDIS_SENTINEL_PORT,
            sentinel_name=config.REDIS_SENTINEL_NAME,
        )

        # Initialize Object Storage
        self.storage_engine = ObjectStorageEngine(
            endpoint=config.OBJECT_STORAGE_ENDPOINT,
            access_key=config.OBJECT_STORAGE_ACCESS_KEY,
            secret_key=config.OBJECT_STORAGE_SECRET_KEY,
            bucket=config.OBJECT_STORAGE_BUCKET,
            region=config.OBJECT_STORAGE_REGION,
        )

        log_json("storage_service_initialized")

    def start(self):
        """Start the storage service worker loop"""
        log_json("storage_service_starting")
        self.running = True

        while self.running:
            try:
                # Scan for queues matching the pattern
                self._scan_and_process_queues()

                # Wait before next scan
                time.sleep(config.QUEUE_SCAN_INTERVAL_SEC)

            except KeyboardInterrupt:
                log_json("storage_service_interrupted")
                self.stop()
                break
            except Exception as e:
                log_json("storage_service_error", error=str(e))
                time.sleep(5)

    def _scan_and_process_queues(self):
        """Scan Redis for audio queues and process them"""
        cursor = 0
        pattern = f"{config.REDIS_AUDIO_QUEUE_PREFIX}:*"

        while True:
            cursor, keys = self.redis_client.scan(cursor=cursor, match=pattern, count=10)

            for key in keys:
                # Parse key: interview:audio:queue:{interview_id}
                key_str = key.decode("utf-8") if isinstance(key, bytes) else key
                parts = key_str.split(":")

                if len(parts) >= 4:
                    try:
                        interview_id = parts[3]
                        # TODO: Retrieve actual user_id from metadata or separate Redis key
                        user_id = interview_id  # Placeholder

                        # Process the queue
                        success = process_audio_queue(
                            redis_client=self.redis_client,
                            queue_key=key_str,
                            interview_id=interview_id,
                            user_id=user_id,
                            storage_engine=self.storage_engine,
                            timeout_sec=config.QUEUE_TIMEOUT_SEC,
                        )

                        # Delete queue after successful processing
                        if success:
                            self.redis_client.delete(key_str)
                            log_json("queue_deleted", queue_key=key_str)

                    except (ValueError, IndexError) as e:
                        log_json("invalid_queue_key", key=key_str, error=str(e))

            if cursor == 0:
                break

    def stop(self):
        """Stop the storage service and cleanup resources"""
        log_json("storage_service_stopping")
        self.running = False
        log_json("storage_service_stopped")

