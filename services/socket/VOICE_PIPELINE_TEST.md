# 음성 STT 파이프라인 테스트 가이드

## 개요

음성 입력 -> STT gRPC -> Redis Pub/Sub 또는 Stream -> Socket -> 클라이언트 흐름을 테스트하기 위한 가이드입니다.

> 참고: STT 결과는 Redis 채널(`stt.transcript`) 또는 스트림(`stt.transcript.stream`)으로 전달되어야 합니다.

## 전제 조건

1. 로컬 Kubernetes 클러스터 또는 Docker Compose 환경 실행 중
2. Redis 서비스가 정상 동작 중
3. STT gRPC 서비스가 정상 동작 중
4. Socket 서비스가 정상 동작 중

## 테스트 단계

### 1. STT 서비스 확인

STT 서비스가 정상적으로 떠 있는지 확인합니다.

```bash
# STT 서비스 로그 확인 (예: stt 또는 inference)
kubectl logs -f deployment/stt -n unbrdn
```

### 2. Socket 서비스 확인

Socket 서비스가 Redis 구독을 정상적으로 시작했는지 확인합니다.

```bash
# Socket Pod 로그 확인
kubectl logs -f deployment/socket -n unbrdn

# 예상 출력:
# {"service":"socket","event":"redis_stt_subscribed","channel":"stt.transcript",...}
# {"service":"socket","event":"redis_llm_subscribed","channel":"llm.botquestion",...}
```

### 3. 테스트 클라이언트 준비

`services/bff/test-client.html` 파일을 수정하여 음성 녹음 기능을 추가합니다.

```html
<!DOCTYPE html>
<html>
<head>
  <title>Voice Interview Test</title>
  <script src="/socket.io/socket.io.js"></script>
</head>
<body>
  <h1>음성 면접 테스트 클라이언트</h1>
  
  <div>
    <label>Interview ID: <input type="number" id="interviewId" value="1" /></label>
    <label>Token: <input type="text" id="token" value="valid-jwt" /></label>
  </div>
  
  <button id="connect">연결</button>
  <button id="disconnect">연결 해제</button>
  
  <div>
    <button id="startRecord">녹음 시작</button>
    <button id="stopRecord" disabled>녹음 중지</button>
  </div>
  
  <div id="status">연결 안됨</div>
  <div id="messages"></div>

  <script>
    let socket;
    let mediaRecorder;
    let audioChunks = [];

    document.getElementById('connect').onclick = () => {
      const interviewId = document.getElementById('interviewId').value;
      const token = document.getElementById('token').value;
      
      socket = io('http://localhost:3002', {
        query: { interviewId, token },
        auth: { token }
      });

      socket.on('connect', () => {
        document.getElementById('status').innerText = '연결됨';
        console.log('Connected:', socket.id);
      });

      socket.on('text_received', (data) => {
        const msg = document.createElement('div');
        msg.innerHTML = `<strong>STT 결과:</strong> ${data.text}`;
        msg.style.color = 'blue';
        document.getElementById('messages').appendChild(msg);
        console.log('Text received:', data);
      });

      socket.on('disconnect', () => {
        document.getElementById('status').innerText = '연결 끊김';
      });
    };

    document.getElementById('disconnect').onclick = () => {
      if (socket) socket.disconnect();
    };

    document.getElementById('startRecord').onclick = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          const reader = new FileReader();
          
          reader.onloadend = () => {
            const base64Audio = reader.result.split(',')[1];
            const interviewId = parseInt(document.getElementById('interviewId').value);
            
            // Socket.io로 오디오 전송
            socket.emit('audio_chunk', {
              chunk: base64Audio,
              interviewId: interviewId
            });

            const msg = document.createElement('div');
            msg.innerText = `오디오 전송 완료 (${audioBlob.size} bytes)`;
            msg.style.color = 'green';
            document.getElementById('messages').appendChild(msg);
          };

          reader.readAsDataURL(audioBlob);
        };

        mediaRecorder.start();
        document.getElementById('startRecord').disabled = true;
        document.getElementById('stopRecord').disabled = false;
        
        const msg = document.createElement('div');
        msg.innerText = '녹음 중...';
        msg.style.color = 'red';
        document.getElementById('messages').appendChild(msg);
      } catch (error) {
        alert('마이크 권한이 필요합니다: ' + error);
      }
    };

    document.getElementById('stopRecord').onclick = () => {
      if (mediaRecorder) {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        document.getElementById('startRecord').disabled = false;
        document.getElementById('stopRecord').disabled = true;
      }
    };
  </script>
</body>
</html>
```

### 4. 전체 파이프라인 테스트

1. **Socket 서비스 포트포워딩**:
   ```bash
   kubectl port-forward svc/socket 3002:3002 -n unbrdn
   ```

2. **테스트 클라이언트 열기**:
   - 브라우저에서 `services/bff/test-client.html` 파일 열기
   - Interview ID 입력 (예: 1)
   - Token 입력 (유효한 JWT)
   - "연결" 버튼 클릭

3. **음성 녹음 및 전송**:
   - "녹음 시작" 버튼 클릭
   - 마이크에 대고 말하기
   - 3-5초 후 "녹음 중지" 버튼 클릭
   - 오디오가 자동으로 Socket 서비스로 전송됨

4. **로그 모니터링**:

   **Terminal 1 - Socket 로그**:
   ```bash
   kubectl logs -f deployment/socket -n unbrdn
   # 예상 출력:
   # {"event":"audio_chunk_FINAL_received",...}
   # {"event":"stt_text_sent_to_client",...}
   ```

   **Terminal 2 - STT 로그**:
   ```bash
   kubectl logs -f deployment/stt -n unbrdn
   # 예상 출력:
   # STT processing logs...
   ```

5. **클라이언트에서 결과 확인**:
   - 테스트 클라이언트 화면에 파란색으로 "STT 결과" 메시지 표시 확인
   - 브라우저 개발자 도구 콘솔에서 `text_received` 이벤트 수신 확인

### 5. 기존 면접 흐름과 통합 테스트

STT 결과를 받은 후 기존 텍스트 기반 면접 흐름이 동작하는지 확인합니다.

```javascript
// 테스트 클라이언트에 추가
socket.on('text_received', (data) => {
  // STT 결과 표시
  console.log('STT 결과:', data.text);
  
  // 자동으로 send_answer 이벤트 전송 (기존 면접 흐름)
  socket.emit('send_answer', { answer: data.text });
});

socket.on('stream_chunk', (chunk) => {
  // AI 면접관 응답 수신
  console.log('AI 응답:', chunk);
});

socket.on('stream_end', () => {
  console.log('AI 응답 완료');
});
```

## 예상 전체 흐름

```
1. 클라이언트: 음성 녹음 -> Base64 인코딩
   ↓
2. Socket 서비스: audio_chunk 이벤트 수신 -> STT gRPC 스트림 전송
   ↓
3. STT 서비스: 텍스트 변환 -> Redis Pub/Sub 또는 Stream 발행
   ↓
4. Socket 서비스: Redis 수신 -> text_received 이벤트 전송
   ↓
5. 클라이언트: text_received 수신 -> UI 표시
   ↓
6. 클라이언트: send_answer 이벤트 전송 (기존 흐름)
   ↓
7. Socket -> LLM /interview API -> stream_chunk
   ↓
8. 클라이언트: AI 면접관 질문 수신
```

## 문제 해결

### 1. STT 결과가 빈 문자열

**증상**: `{"text":""}` 또는 텍스트가 전달되지 않음

**원인**: 오디오 형식 불일치 또는 음성이 너무 짧음

**해결**:
- 최소 3초 이상 녹음
- MediaRecorder 형식 확인 (`audio/webm` 권장)
- STT 로그에서 에러 메시지 확인

### 2. Redis 구독 실패

**증상**: `redis_stt_subscribe_error` 또는 `redis_stt_subscribe_failed` 로그

**원인**: Redis 연결 실패 또는 인증 오류

**해결**:
- Redis 연결 정보 확인 (`REDIS_HOST/PORT`, Sentinel 설정 등)
- Redis Pod 상태 확인

### 3. Socket에서 text_received 이벤트가 전달되지 않음

**증상**: Redis에 텍스트가 올라오지만 클라이언트가 받지 못함

**원인**: interviewId 매핑이 없거나 Socket 연결 시 interviewId를 전달하지 않음

**해결**:
- 클라이언트 연결 시 `query: { interviewId }` 파라미터 확인
- Socket 로그에서 `interview_socket_mapped` 이벤트 확인

## 성능 벤치마크 (예상)

| 항목 | 시간 |
|------|------|
| 오디오 전송 (WebSocket) | ~100ms |
| Redis Pub/Sub 또는 Stream | ~50ms |
| Whisper STT (base, 3초 오디오) | 1-3초 (CPU) |
| Socket 전달 | ~50ms |
| **총 지연시간** | **1.3-3.2초** |

## 완료 기준

- [ ] STT 서비스 정상 동작
- [ ] Socket 서비스가 Redis 채널/스트림을 수신
- [ ] 클라이언트에서 `text_received` 이벤트 수신
- [ ] 변환된 텍스트로 `send_answer` 흐름이 정상 동작
