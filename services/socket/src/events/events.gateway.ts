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
  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  // 클라이언트 연결 해제 처리
  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  // 클라이언트가 'send_answer' 메시지를 보내면 실행됨
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
