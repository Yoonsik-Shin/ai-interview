"""
Kafka Consumer for STT (Speech-to-Text)
Phase 3: 실시간 음성 파이프라인
"""
from kafka import KafkaConsumer
import json
import os
from dotenv import load_dotenv

load_dotenv()

# Kafka 설정
KAFKA_BROKER = os.getenv('KAFKA_BROKER', 'kafka:29092')
INPUT_TOPIC = 'interview.audio.input'
OUTPUT_TOPIC = 'interview.text.input'

def consume_audio_chunks():
    """
    Kafka에서 오디오 청크를 소비하고 STT를 수행합니다.
    TODO: Whisper 연동 및 텍스트 변환 구현
    """
    consumer = KafkaConsumer(
        INPUT_TOPIC,
        bootstrap_servers=[KAFKA_BROKER],
        value_deserializer=lambda m: json.loads(m.decode('utf-8')),
        group_id='stt-consumer-group'
    )
    
    print(f"STT Consumer started, listening to {INPUT_TOPIC}")
    
    for message in consumer:
        data = message.value
        interview_id = data.get('interviewId')
        user_id = data.get('userId')
        audio_chunk = data.get('audioChunk')
        
        print(f"Received audio chunk: interviewId={interview_id}, userId={user_id}")
        
        # TODO: STT 처리 (Whisper 연동)
        # TODO: 변환된 텍스트를 interview.text.input 토픽으로 전송

if __name__ == '__main__':
    consume_audio_chunks()

