import time
import redis

import config
from utils.log_format import log_json
from engine.object_storage import ObjectStorageEngine
from engine.mongodb import MongoDBEngine
from event.consumer import init_redis_client
from service.worker.queue_processor import process_audio_queue
from service.worker.history_sink import start_history_sink_worker
import threading


class StorageService:
    """Main storage service orchestrator"""

    def __init__(self):
        self.redis_client: redis.Redis = None
        self.storage_engine: ObjectStorageEngine = None
        self.mongodb_engine: MongoDBEngine = None
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
            public_endpoint=config.OBJECT_STORAGE_PUBLIC_ENDPOINT,
        )

        # Initialize MongoDB
        self.mongodb_engine = MongoDBEngine(
            uri=config.MONGODB_URI,
            database_name=config.MONGODB_DB_NAME,
            collection_name=config.MONGODB_COLLECTION
        )
        self.mongodb_engine.connect()

        log_json("storage_service_initialized")

    def start(self):
        """Start the storage service worker loop"""
        log_json("storage_service_starting")
        self.running = True

        # Start History Sync Worker in a separate thread
        history_thread = threading.Thread(
            target=start_history_sink_worker,
            args=(self.mongodb_engine,),
            daemon=True
        )
        history_thread.start()
        log_json("history_sink_thread_started")

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

            if keys:
                log_json("redis_scan_found_keys", pattern=pattern, count=len(keys), keys=[k.decode("utf-8") if isinstance(k, bytes) else k for k in keys])

            for key in keys:
                # Parse key: interview:audio:queue:{interview_id}
                key_str = key.decode("utf-8") if isinstance(key, bytes) else key
                parts = key_str.split(":")

                if len(parts) >= 4:
                    try:
                        interview_id = parts[3]
                        log_json("processing_interview_queue", interview_id=interview_id, key=key_str)
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
        if self.mongodb_engine:
            self.mongodb_engine.close()
        log_json("storage_service_stopped")

