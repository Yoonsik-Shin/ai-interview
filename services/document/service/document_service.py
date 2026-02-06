import json
import time
import threading
from confluent_kafka import Consumer, Producer, KafkaException
import config
from utils.log_format import log_json
from engine.extraction_engine import ExtractionEngine

class DocumentService:
    def __init__(self):
        self.consumer = None
        self.producer = None
        self.storage_engine = None
        self.extraction_engine = None
        self.running = False

    def initialize(self):
        """Initialize all components"""
        log_json("document_service_initializing")
        
        # 1. Kafka Consumer 설정
        conf = {
            'bootstrap.servers': config.KAFKA_BOOTSTRAP_SERVERS,
            'group.id': config.KAFKA_GROUP_ID,
            'auto.offset.reset': 'earliest'
        }
        self.consumer = Consumer(conf)
        self.consumer.subscribe([config.KAFKA_DOCUMENT_PROCESS_TOPIC])

        # 2. Kafka Producer 설정
        self.producer = Producer({'bootstrap.servers': config.KAFKA_BOOTSTRAP_SERVERS})

        # 3. 추출 엔진 초기화
        self.extraction_engine = ExtractionEngine()

        log_json("document_service_initialized")

    def start(self):
        """Start the document service worker loop"""
        log_json("document_service_starting")
        self.running = True

        while self.running:
            try:
                msg = self.consumer.poll(1.0)
                if msg is None:
                    continue
                if msg.error():
                    log_json("kafka_error", error=str(msg.error()))
                    continue

                event = json.loads(msg.value().decode('utf-8'))
                resume_id = event.get("resumeId")
                log_json("kafka_message_received", topic=msg.topic(), resume_id=resume_id)
                
                # 처리 로직 실행
                self._process_document(event)

            except Exception as e:
                log_json("document_loop_error", error=str(e))
                time.sleep(1)

    def _process_document(self, event):
        resume_id = event.get("resumeId")
        file_path = event.get("filePath")
        download_url = event.get("downloadUrl")
        
        if not resume_id or not download_url:
            log_json("invalid_event", event=event)
            return

        try:
            # 1. 텍스트 및 이미지 추출
            result = self.extraction_engine.extract_all(resume_id, download_url)
            
            # 2. 결과 Kafka 발행 (Core 서비스가 구독)
            self._send_processed_event(resume_id, result)
            
        except Exception as e:
            log_json("document_processing_failed", resume_id=resume_id, error=str(e))
            self._send_failed_event(resume_id, str(e))

    def _send_processed_event(self, resume_id, result):
        event = {
            "resumeId": resume_id,
            "status": "COMPLETED",
            "content": result.get("text"),
            "imageUrls": result.get("image_urls"),
            "vectorStatus": "PENDING"  # 벡터 저장은 향후 고도화 예정
        }
        
        try:
            self.producer.produce(
                config.KAFKA_DOCUMENT_PROCESSED_TOPIC,
                key=str(resume_id),
                value=json.dumps(event, ensure_ascii=False)
            )
            self.producer.flush()
            log_json("kafka_result_sent", 
                     topic=config.KAFKA_DOCUMENT_PROCESSED_TOPIC, 
                     resume_id=resume_id)
        except Exception as e:
            log_json("kafka_produce_failed", resume_id=resume_id, error=str(e))

    def _send_failed_event(self, resume_id, error_msg):
        event = {
            "resumeId": resume_id,
            "status": "FAILED",
            "error": error_msg
        }
        try:
            self.producer.produce(
                config.KAFKA_DOCUMENT_PROCESSED_TOPIC,
                key=str(resume_id),
                value=json.dumps(event)
            )
            self.producer.flush()
        except Exception as e:
            log_json("kafka_produce_failed", resume_id=resume_id, error=str(e))

    def stop(self):
        """Stop the service and cleanup"""
        log_json("document_service_stopping")
        self.running = False
        if self.consumer:
            self.consumer.close()
        log_json("document_service_stopped")
