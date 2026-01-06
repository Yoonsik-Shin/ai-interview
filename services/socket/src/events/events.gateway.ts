import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { StringDecoder } from "string_decoder";
import axios from "axios";
import { Kafka, Producer } from "kafkajs";

@WebSocketGateway({ cors: { origin: "*" } })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server: Server;

  private readonly kafka: Kafka;
  private readonly producer: Producer;

  constructor() {
    const kafkaBroker = process.env.KAFKA_BROKER || "kafka:29092";
    this.kafka = new Kafka({
      brokers: [kafkaBroker],
      retry: {
        retries: 5,
        initialRetryTime: 1000,
      },
    });
    this.producer = this.kafka.producer();
    // 비동기로 연결 시도, 실패해도 앱은 시작됨
    this.producer.connect().catch((error) => {
      console.error("Failed to connect to Kafka:", error);
      console.log("Will retry when Kafka is available...");
    });
  }

  // 클라이언트 연결 처리
  async handleConnection(client: Socket) {
    // JWT 토큰 검증 (쿼리 파라미터 또는 헤더에서)
    const token = client.handshake.auth?.token || client.handshake.query?.token;
    
    if (!token) {
      console.log(`Client connection rejected: No token - ${client.id}`);
      client.disconnect();
      return;
    }

    // TODO: JWT 토큰 검증 로직 추가 (BFF의 JWT Strategy 재사용 또는 별도 검증)
    // 현재는 토큰 존재 여부만 확인
    console.log(`Client connected: ${client.id}, token: ${token ? 'present' : 'missing'}`);
    
    // 세션 정보를 클라이언트에 저장
    (client as any).userId = token; // TODO: 실제 userId 추출
  }

  // 클라이언트 연결 해제 처리
  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  // 오디오 청크 수신 및 Kafka 전송
  @SubscribeMessage("audio_chunk")
  async handleAudioChunk(
    client: Socket,
    payload: { chunk: Buffer | string; interviewId: number }
  ): Promise<void> {
    const userId = (client as any).userId;
    console.log(`Audio chunk received: interviewId=${payload.interviewId}, userId=${userId}`);

    try {
      // 오디오 청크를 Kafka로 전송
      const audioData = typeof payload.chunk === 'string' 
        ? Buffer.from(payload.chunk, 'base64') 
        : payload.chunk;

      await this.producer.send({
        topic: 'interview.audio.input',
        messages: [
          {
            key: `${payload.interviewId}:${userId}`,
            value: JSON.stringify({
              interviewId: payload.interviewId,
              userId: userId,
              audioChunk: audioData.toString('base64'),
              timestamp: new Date().toISOString(),
            }),
          },
        ],
      });

      console.log(`Audio chunk sent to Kafka: interviewId=${payload.interviewId}`);
    } catch (error) {
      console.error('Kafka Send Failed:', error);
      client.emit('error', 'Failed to send audio chunk');
    }
  }

  // 클라이언트가 'send_answer' 메시지를 보내면 실행됨 (기존 텍스트 채팅용)
  @SubscribeMessage("send_answer")
  async handleMessage(
    client: Socket,
    payload: { answer: string }
  ): Promise<void> {
    console.log(`User Answer: ${payload.answer}`);

    try {
      // Inference 서비스 직접 호출 (실시간성 최우선)
      const pythonWorkerUrl =
        process.env.PYTHON_WORKER_URL || "http://inference:8000";
      const response = await axios.post(
        `${pythonWorkerUrl}/interview`,
        { user_answer: payload.answer },
        { responseType: "stream" }
      );
      const stream = response.data;

      // UTF-8 디코더 생성
      const decoder = new StringDecoder("utf-8");
      let fullAiResponse = "";

      stream.on("data", (chunk: Buffer) => {
        const text = decoder.write(chunk);
        if (!text) return;

        fullAiResponse += text;
        console.log(`Received chunk: ${text}`);
        client.emit("stream_chunk", text);
      });

      stream.on("end", async () => {
        // 마지막 남은 바이트 처리
        const remaining = decoder.end();
        if (remaining) {
          fullAiResponse += remaining;
          client.emit("stream_chunk", remaining);
        }

        console.log("Stream finished.");
        client.emit("stream_end", "Done");

        // Kafka로 결과 전송
        console.log("Sending result to Kafka...");
        try {
          await this.producer.send({
            topic: "interview-result",
            messages: [
              {
                value: JSON.stringify({
                  userAnswer: payload.answer,
                  aiAnswer: fullAiResponse,
                }),
              },
            ],
          });
          console.log("✅ Kafka Sent Success");
        } catch (e) {
          console.error("Kafka Send Failed:", e);
        }
      });
    } catch (error) {
      console.error("Python Stream Error:", error);
      client.emit("error", "AI Connection Failed");
    }
  }
}
