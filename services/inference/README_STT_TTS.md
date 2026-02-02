# STT/TTS 서비스 가이드

## 개요

AI 면접 시스템의 음성 처리 서비스입니다.

- **STT (Speech-to-Text)**: Sherpa-ONNX (Streaming Zipformer)
- **TTS (Text-to-Speech)**: 하이브리드 (OpenAI + Edge-TTS)

---

## STT (Speech-to-Text)

### Sherpa-ONNX (기본)

**특징:**

- 처리 시간: 0.5-1초 (Whisper 대비 50-100배 빠름)
- 실시간 스트리밍 지원
- ARM CPU 최적화 (NEON 가속)
- 메모리: 512Mi
- 정확도 (WER): 6-7%

**사용 방법:**

```bash
# 1. Sherpa-ONNX 모델 다운로드
./download_sherpa_models.sh

# 2. Kafka Consumer 실행
export SHERPA_MODEL_DIR=/app/models/sherpa-onnx
export KAFKA_BROKER=kafka:29092
python kafka_consumer_stt_sherpa.py
```

**Kafka 메시지 포맷:**

입력 (Topic: `interview.audio.input`):

```json
{
  "interviewId": 123,
  "userId": "user_456",
  "audioChunk": "base64_encoded_audio",
  "traceId": "uuid"
}
```

출력 (Topic: `interview.text.input`):

```json
{
  "interviewId": 123,
  "userId": "user_456",
  "text": "변환된 텍스트",
  "timestamp": "2026-01-09T12:00:00Z",
  "traceId": "uuid",
  "engine": "sherpa-onnx"
}
```

### Whisper (백업)

**사용 방법:**

```bash
# Whisper STT Consumer (느리지만 더 정확)
python kafka_consumer.py
```

---

## TTS (Text-to-Speech)

### 하이브리드 전략

| 모드     | 엔진           | 특징                  | 비용      |
| -------- | -------------- | --------------------- | --------- |
| **연습** | Edge-TTS       | MS Azure급 품질, 무료 | $0        |
| **실전** | OpenAI TTS API | 감정 표현, 페르소나   | $0.075/회 |

### API 사용법

#### 1. 텍스트 → 음성 변환

**연습 모드 (무료):**

```bash
curl -X POST http://localhost:8000/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "자기소개 해주세요",
    "mode": "practice"
  }' \
  --output audio.mp3
```

**실전 모드 (OpenAI):**

```bash
curl -X POST http://localhost:8000/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "그 부분에 대해 좀 더 구체적으로 설명해주시겠어요?",
    "mode": "real",
    "persona": "PRESSURE",
    "speed": 1.0
  }' \
  --output audio.mp3
```

**페르소나 종류:**

- `PRESSURE`: 낮고 단호한 톤 (onyx)
- `COMFORTABLE`: 밝고 부드러운 톤 (nova)
- `RANDOM`: 중립적 (alloy)

#### 2. 필러 워드 (즉각 반응용)

```bash
curl http://localhost:8000/tts/filler
```

응답:

```json
{
  "text": "음, 그렇군요",
  "audioUrl": "/assets/tts/filler_123.mp3",
  "traceId": "uuid"
}
```

#### 3. 사용 가능한 음성 목록

```bash
curl http://localhost:8000/tts/voices
```

응답:

```json
{
  "openai": {
    "PRESSURE": "onyx",
    "COMFORTABLE": "nova",
    "RANDOM": "alloy"
  },
  "edge": {
    "female_formal": "ko-KR-SunHiNeural",
    "male_formal": "ko-KR-InJoonNeural",
    "female_casual": "ko-KR-SoonBokMultilingualNeural"
  }
}
```

---

## Python 코드 예시

### STT (Sherpa-ONNX)

```python
from kafka import KafkaConsumer
import json
import sherpa_onnx

# 인식기 초기화
recognizer = sherpa_onnx.OnlineRecognizer.from_transducer(
    tokens="/app/models/sherpa-onnx/tokens.txt",
    encoder="/app/models/sherpa-onnx/encoder-epoch-99-avg-1.onnx",
    decoder="/app/models/sherpa-onnx/decoder-epoch-99-avg-1.onnx",
    joiner="/app/models/sherpa-onnx/joiner-epoch-99-avg-1.onnx",
    num_threads=2,
    sample_rate=16000,
)

# 스트림 생성
stream = recognizer.create_stream()

# 오디오 입력
stream.accept_waveform(16000, audio_samples)

# 디코딩
while recognizer.is_ready(stream):
    recognizer.decode_stream(stream)

# 결과
result = recognizer.get_result(stream)
print(result)
```

### TTS (OpenAI + Edge-TTS)

```python
from tts_service import generate_tts_openai, generate_tts_edge

# OpenAI TTS (실전)
audio_bytes = generate_tts_openai(
    text="질문 텍스트",
    persona="PRESSURE",
    speed=1.0
)

# Edge-TTS (연습)
audio_bytes = await generate_tts_edge(
    text="질문 텍스트",
    voice="ko-KR-SunHiNeural"
)

# 파일 저장
with open("output.mp3", "wb") as f:
    f.write(audio_bytes)
```

---

## 환경 변수

```bash
# Kafka
KAFKA_BROKER=kafka:29092

# Sherpa-ONNX
SHERPA_MODEL_DIR=/app/models/sherpa-onnx

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-3.5-turbo

# Whisper (백업)
ENABLE_WHISPER_STT=false
```

---

## Docker 사용법

### 빌드

```bash
cd services/inference
docker build -t llm:latest .
```

### 실행

```bash
docker run -d \
  --name llm \
  -p 8000:8000 \
  -e KAFKA_BROKER=kafka:29092 \
  -e OPENAI_API_KEY=sk-... \
  -e SHERPA_MODEL_DIR=/app/models/sherpa-onnx \
  llm:latest
```

### 로그 확인

```bash
# 전체 로그
docker logs -f llm

# STT만
docker exec llm supervisorctl tail -f stt-consumer-sherpa

# FastAPI만
docker exec llm supervisorctl tail -f fastapi
```

---

## 성능 벤치마크

### STT 처리 시간

| 오디오 길이 | Whisper base | Sherpa-ONNX | 개선 |
| ----------- | ------------ | ----------- | ---- |
| 3초         | 50초         | **0.8초**   | 62배 |
| 10초        | 180초        | **2.5초**   | 72배 |
| 30초        | 540초        | **8초**     | 67배 |

### TTS 생성 시간

| 텍스트 길이 | Edge-TTS | OpenAI TTS |
| ----------- | -------- | ---------- |
| 20자        | 1.2초    | 1.5초      |
| 100자       | 2.5초    | 2.8초      |
| 500자       | 8초      | 9초        |

---

## 문제 해결

### Sherpa-ONNX 모델이 없음

```bash
# 모델 다운로드
./download_sherpa_models.sh

# 수동 다운로드
mkdir -p /app/models/sherpa-onnx
wget https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-korean-2024-06-16/resolve/main/tokens.txt
wget https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-korean-2024-06-16/resolve/main/encoder-epoch-99-avg-1.onnx
wget https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-korean-2024-06-16/resolve/main/decoder-epoch-99-avg-1.onnx
wget https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-korean-2024-06-16/resolve/main/joiner-epoch-99-avg-1.onnx
```

### OpenAI API 에러

```bash
# API 키 확인
echo $OPENAI_API_KEY

# API 키 설정
export OPENAI_API_KEY=sk-...

# Kubernetes Secret
kubectl create secret generic llm-secrets \
  --from-literal=OPENAI_API_KEY=sk-... \
  -n unbrdn
```

### Edge-TTS 연결 실패

```bash
# 네트워크 확인
ping api.openai.com

# DNS 확인
nslookup speech.platform.bing.com
```

---

## 참고 문서

- [Sherpa-ONNX GitHub](https://github.com/k2-fsa/sherpa-onnx)
- [Edge-TTS Python Library](https://github.com/rany2/edge-tts)
- [OpenAI TTS API](https://platform.openai.com/docs/guides/text-to-speech)
- [design-decisions.md의 "13. 음성 처리 전략"](../../docs/design-decisions.md#13-음성-처리-전략-stt--tts)
