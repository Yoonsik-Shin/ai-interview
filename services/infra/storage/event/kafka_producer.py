import json
from confluent_kafka import Producer
from utils.log_format import log_json
import config

class KafkaProducer:
    def __init__(self):
        self.producer_config = {
            'bootstrap.servers': config.KAFKA_BROKER,
            'client.id': 'storage-service-producer'
        }
        self.producer = Producer(self.producer_config)

    def delivery_report(self, err, msg):
        """Called once for each message transmitted to indicate delivery result."""
        if err is not None:
            log_json("kafka_delivery_failed", error=str(err))
        else:
            log_json("kafka_delivery_success", topic=msg.topic(), partition=msg.partition())

    def publish_storage_completed(self, interview_id: str, user_id: str, object_url: str, object_key: str, metadata: dict):
        """
        Publish storage.completed event to Kafka
        """
        payload = {
            "interviewId": interview_id,
            "userId": user_id,
            "objectUrl": object_url,
            "objectKey": object_key,
            "metadata": metadata,
            "timestamp": metadata.get("timestamp")
        }
        
        try:
            self.producer.produce(
                config.STORAGE_COMPLETED_TOPIC,
                key=interview_id,
                value=json.dumps(payload).encode('utf-8'),
                callback=self.delivery_report
            )
            # Flush to ensure delivery (since this is a background worker, we can afford a quick flush or rely on periodic flush)
            self.producer.poll(0)
            log_json("kafka_publish_storage_completed", interview_id=interview_id, topic=config.STORAGE_COMPLETED_TOPIC)
        except Exception as e:
            log_json("kafka_publish_failed", error=str(e), interview_id=interview_id)

    def flush(self):
        self.producer.flush()

# Global producer instance
_producer = None

def get_kafka_producer():
    global _producer
    if _producer is None:
        _producer = KafkaProducer()
    return _producer
