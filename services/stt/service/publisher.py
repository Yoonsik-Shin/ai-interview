import json
from config import (
    KAFKA_ENABLED,
    OUTPUT_TOPIC,
    STT_REDIS_STREAM,
    STT_REDIS_CHANNEL,
)
from utils.log_format import log_json
from event.producer import publish_event
from event.redis_pub import publish_redis
from event.redis_stream import publish_stream


class SttPublisher:
    """
    STT 결과 발행을 전담하는 클래스
    - Kafka (Event)
    - Redis Stream (Log/Reliability)
    - Redis Pub/Sub (Real-time)
    """

    def publish(self, payload: dict, key: str):
        """
        STT 결과를 다양한 채널로 발행합니다.
        
        Args:
            payload (dict): 발행할 데이터
            key (str): 파티셔닝 키 (주로 interview_id)
        """
        interview_id = payload.get("interviewId")

        # debug-로 시작하면 Kafka/RedisStream 발행을 건너뜀 (core 서비스 에러 방지)
        if str(interview_id).startswith("debug-"):
            log_json("stt_debug_publish_skip_sf", interview_id=interview_id)
        else:
            # 1. Kafka Publish
            if KAFKA_ENABLED:
                try:
                    publish_event(topic=OUTPUT_TOPIC, value=payload, key=key)
                except Exception as exc:
                    log_json("kafka_publish_error", error=str(exc), interview_id=interview_id)

            # 2. Redis Stream Publish
            try:
                publish_stream(STT_REDIS_STREAM, payload)
            except Exception as exc:
                log_json("redis_stream_publish_error", error=str(exc), interview_id=interview_id)

        # 3. Redis Pub/Sub Publish
        try:
            publish_redis(STT_REDIS_CHANNEL, json.dumps(payload))
        except Exception as exc:
            log_json("redis_publish_error", error=str(exc), interview_id=interview_id)
