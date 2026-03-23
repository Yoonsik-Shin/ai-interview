import json
from confluent_kafka import Consumer, KafkaError
from engine.mongodb import MongoDBEngine
import config
from utils.log_format import log_json

def start_history_sink_worker(mongodb_engine: MongoDBEngine):
    """
    Worker that consumes interview messages from Kafka and sinks them to MongoDB
    """
    conf = {
        'bootstrap.servers': config.KAFKA_BROKER,
        'group.id': config.KAFKA_GROUP_ID,
        'auto.offset.reset': 'earliest'
    }

    consumer = Consumer(conf)
    consumer.subscribe([config.INTERVIEW_MESSAGES_TOPIC])

    log_json("history_sink_worker_started", topic=config.INTERVIEW_MESSAGES_TOPIC)

    try:
        while True:
            msg = consumer.poll(1.0)

            if msg is None:
                continue
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                else:
                    log_json("kafka_consumer_error", error=str(msg.error()))
                    break

            try:
                # Expected message format: { "interview_id": "...", "payload": { "role": "...", "type": "...", "content": "..." } }
                message_data = json.loads(msg.value().decode('utf-8'))
                interview_id = message_data.get("interview_id")
                payload = message_data.get("payload", {})

                if interview_id and payload:
                    success = mongodb_engine.save_message(interview_id, payload)
                    if not success:
                         log_json("sink_failed_retrying_logic_needed", interview_id=interview_id)
                else:
                    log_json("invalid_message_format", data=message_data)

            except json.JSONDecodeError as e:
                log_json("message_decode_error", error=str(e), raw_value=str(msg.value()))
            except Exception as e:
                log_json("sink_worker_internal_error", error=str(e))

    finally:
        consumer.close()
        log_json("history_sink_worker_stopped")
