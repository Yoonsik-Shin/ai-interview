import { IoAdapter } from "@nestjs/platform-socket.io";
import { Server, ServerOptions } from "socket.io";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: any;

  async connectToRedis(): Promise<void> {
    try {
      // 1. PubClient 생성 (메시지 발행용)
      const redisHost = process.env.REDIS_HOST || "redis";
      const redisPort = process.env.REDIS_PORT || "6379";
      const pubClient = createClient({
        url: `redis://${redisHost}:${redisPort}`,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error("❌ Redis 재연결 시도 횟수 초과");
              return new Error("Redis 재연결 실패");
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      // 에러 핸들링
      pubClient.on("error", (err) => {
        console.error("❌ Redis PubClient 에러:", err);
      });

      // 2. SubClient 생성 (메시지 구독용)
      const subClient = pubClient.duplicate();
      subClient.on("error", (err) => {
        console.error("❌ Redis SubClient 에러:", err);
      });

      await Promise.all([pubClient.connect(), subClient.connect()]);

      // 3. Redis Adapter 생성
      this.adapterConstructor = createAdapter(pubClient, subClient);
      console.log("✅ Socket.io Redis Adapter Connected!");
    } catch (error) {
      console.error("❌ Redis 연결 실패:", error);
      throw error;
    }
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    // WebSocket 연결 안정성을 위한 명시적 옵션 설정
    // 타임아웃 값 검증 및 기본값 설정
    const defaultPingTimeout = 60000; // 60초
    const defaultPingInterval = 25000; // 25초
    const defaultUpgradeTimeout = 10000; // 10초

    // 기존 options에서 타임아웃 값 추출 및 검증
    const pingTimeout = options?.pingTimeout && options.pingTimeout > 0 
      ? options.pingTimeout 
      : defaultPingTimeout;
    const pingInterval = options?.pingInterval && options.pingInterval > 0 && options.pingInterval < pingTimeout
      ? options.pingInterval 
      : defaultPingInterval;
    const upgradeTimeout = options?.upgradeTimeout && options.upgradeTimeout > 0
      ? options.upgradeTimeout 
      : defaultUpgradeTimeout;

    // ServerOptions 타입 호환성을 위해 Partial을 사용하여 옵션 구성
    const serverOptions: Partial<ServerOptions> = {
      ...options,
      // 핵심 옵션은 명시적으로 덮어쓰기 (검증된 값 사용)
      transports: ['websocket', 'polling'], // WebSocket 우선, 폴백으로 polling
      allowEIO3: true, // Socket.io v3 클라이언트 호환성
      pingTimeout,
      pingInterval,
      upgradeTimeout,
      maxHttpBufferSize: 1e6, // 1MB
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    };

    const server = super.createIOServer(port, serverOptions as ServerOptions) as Server;
    // 서버에 어댑터 장착
    server.adapter(this.adapterConstructor);

    return server;
  }
}
