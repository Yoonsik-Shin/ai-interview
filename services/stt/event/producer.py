import os
import json
from confluent_kafka import Producer

KAFKA_BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")

producer = Producer({"bootstrap.servers": KAFKA_BROKER})


def publish_event(topic: str = None, value: dict = None, key: str = None) -> None:
    if value is None:
        raise ValueError("value(dict) must be provided")
    if topic is None:
        raise ValueError("topic(str) must be provided")

    try:
        producer.produce(
            topic=topic,  #
            key=key,  # 파티션 키
            value=json.dumps(value).encode("utf-8"),
        )
        producer.flush()
    except Exception as exc:
        # TODO: 로깅 및 에러 핸들링 강화 필요
        print(f"Kafka publish error: {exc}")
