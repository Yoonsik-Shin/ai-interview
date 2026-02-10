import json
import time
import threading
from confluent_kafka import Consumer, Producer, KafkaException
import config
from utils.log_format import log_json
from engine.extraction_engine import ExtractionEngine
from engine.embedding_engine import EmbeddingEngine
from engine.image_analysis_engine import ImageAnalysisEngine

def simple_hash(text: str) -> int:
    """Matches JS Math.imul(31, h) + charCodeAt logic for debugging"""
    h = 0
    for char in text:
        # Simulate Math.imul(31, h) + charCode
        # In JS: (h << 5) - h is 31 * h
        # We need to stay in 32-bit signed integer range
        h = (31 * h + ord(char)) & 0xFFFFFFFF
        if h > 0x7FFFFFFF:
            h -= 0x100000000
    return h

class DocumentService:
    def __init__(self):
        self.consumer = None
        self.producer = None
        self.extraction_engine = None
        self.embedding_engine = None
        self.image_analysis_engine = None
        self.running = False

    def initialize(self):
        """Initialize all components"""
        log_json("document_service_initializing")
        
        # 1. Kafka Consumer
        conf = {
            'bootstrap.servers': config.KAFKA_BOOTSTRAP_SERVERS,
            'group.id': config.KAFKA_GROUP_ID,
            'auto.offset.reset': 'earliest'
        }
        self.consumer = Consumer(conf)
        self.consumer.subscribe([config.KAFKA_DOCUMENT_PROCESS_TOPIC])

        # 2. Kafka Producer
        self.producer = Producer({'bootstrap.servers': config.KAFKA_BOOTSTRAP_SERVERS})

        # 3. Engines
        self.extraction_engine = ExtractionEngine()
        self.embedding_engine = EmbeddingEngine()
        self.image_analysis_engine = ImageAnalysisEngine()

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
                resume_id = event.get("resumeId") # Expecting UUID string
                log_json("kafka_message_received", 
                         topic=msg.topic(), 
                         resume_id=resume_id,
                         received_keys=list(event.keys()))
                
                # Process
                self._process_document(event)

            except Exception as e:
                log_json("document_loop_error", error=str(e))
                time.sleep(1)

    def _process_document(self, event):
        resume_id = event.get("resumeId")
        # filePath is S3 key or full URL? 
        # Usually from Core it might be filePath "resumes/..."
        # We need a full URL to download locally if not using boto3 directly with key.
        # But ExtractionEngine uses requests.get(file_url).
        # We need to construct URL or expect it in event.
        # Let's check CompleteUploadInteractor (Java). It usually just has filePath.
        # We might need to generate presigned URL here or construct if public.
        # For MVP, let's assume we can construct it via STORAGE_SERVICE_URL + bucket + key
        
        file_path = event.get("filePath")
        # download_url is ignored as we use internal gRPC to get download URL using file_path (key)
        
        if not resume_id or not file_path:
            log_json("invalid_event", event=event)
            return

        try:
            # 1. Extraction (Page-grouped Text + Images)
            log_json("step_extraction_start", resume_id=resume_id, file_path=file_path)
            extract_result = self.extraction_engine.extract_all(resume_id, file_path)
            
            concatenated_text = extract_result["text"]
            pages = extract_result["pages"]
            all_images = extract_result["all_images"]
            
            from utils.text_processor import normalize_text, mask_pii, chunk_text
            
            # --- Type A: Validation Embedding (Global for duplicate check) ---
            # Use preprocessed validation text from event if available (Source Parity)
            val_masked = event.get("validationText")
            if val_masked:
                log_json("debug_use_provided_validation_text", resume_id=resume_id, text_len=len(val_masked))
            else:
                val_processed = normalize_text(concatenated_text)
                val_masked = mask_pii(val_processed)

            text_hash = simple_hash(val_masked)

            log_json("debug_embedding_input", 
                     resume_id=resume_id, 
                     text_preview=val_masked[:200],
                     text_len=len(val_masked),
                     text_hash=text_hash)
            
            validation_embedding = self.embedding_engine.encode(val_masked[:3000])
            log_json("debug_embedding_output",
                     resume_id=resume_id,
                     embedding_preview=validation_embedding[:8], # Show more slots for better visual diff
                     dim=len(validation_embedding))
            
            # --- Type B: Context-Aware RAG Embeddings (Page-by-Page) ---
            all_rag_chunks = []
            enriched_full_content = []

            for page in pages:
                page_num = page["page_num"]
                page_text = page["text"]
                page_images = page["images"]
                
                # 1. Process Page Text
                if page_text.strip():
                    p_norm = normalize_text(page_text)
                    p_masked = mask_pii(p_norm)
                    
                    # Chunk this page's text
                    text_chunks = chunk_text(
                        p_masked, 
                        metadata={"page_num": page_num, "type": "TEXT"}
                    )
                    all_rag_chunks.extend(text_chunks)
                    enriched_full_content.append(p_masked)
                
                # 2. Process Page Images
                for img in page_images:
                    log_json("step_image_analysis", resume_id=resume_id, page=page_num, url=img["url"])
                    desc = self.image_analysis_engine.analyze_image(img["url"])
                    img["description"] = desc # Update image object for reference
                    
                    # Create a specific chunk for this image location
                    desc_norm = normalize_text(f"[Page {page_num} Image] {desc}")
                    desc_masked = mask_pii(desc_norm)
                    
                    img_chunk = {
                        "content": desc_masked,
                        "metadata": {"page_num": page_num, "type": "IMAGE", "url": img["url"]}
                    }
                    all_rag_chunks.append(img_chunk)
                    enriched_full_content.append(desc_masked)

            # 3. Encode all RAG chunks
            log_json("step_rag_encoding", resume_id=resume_id, total_chunks=len(all_rag_chunks))
            for chunk in all_rag_chunks:
                chunk["embedding"] = self.embedding_engine.encode(chunk["content"])
                chunk["category"] = "RESUME_SUMMARY" # Default for RAG identification
                
                # Flatten metadata for easier Kafka/Java consumption if needed
                # But let's keep it structured and see if Java can map it, 
                # or manually flatten now. 
                # To simplify Java DTO Mapping:
                chunk["pageNum"] = chunk["metadata"].get("page_num")
                chunk["chunkType"] = chunk["metadata"].get("type")

            # 4. Produce Result
            final_result = {
                "resumeId": resume_id,
                "status": "COMPLETED",
                "content": "\n\n".join(enriched_full_content),
                "embedding": validation_embedding,
                "validationEmbedding": validation_embedding,
                "chunks": all_rag_chunks,
                "imageUrls": [img["url"] for img in all_images],
                "images": all_images,
                "vectorStatus": "INDEXED"
            }
            
            self._send_processed_event(resume_id, final_result)
            
        except Exception as e:
            log_json("document_processing_failed", resume_id=resume_id, error=str(e))
            self._send_failed_event(resume_id, str(e))

    def _send_processed_event(self, resume_id, result):
        try:
            self.producer.produce(
                config.KAFKA_DOCUMENT_PROCESSED_TOPIC,
                key=str(resume_id),
                value=json.dumps(result, ensure_ascii=False)
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
