import { IoAdapter } from "@nestjs/platform-socket.io";
import { Server, ServerOptions } from "socket.io";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: any;

  async connectToRedis(): Promise<void> {
    // 1. PubClient 생성 (메시지 발행용)
    const redisHost = process.env.REDIS_HOST || "redis";
    const redisPort = process.env.REDIS_PORT || "6379";
    const pubClient = createClient({
      url: `redis://${redisHost}:${redisPort}`,
    });
    // 2. SubClient 생성 (메시지 구독용)
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    // 3. Redis Adapter 생성
    this.adapterConstructor = createAdapter(pubClient, subClient);
    console.log("✅ Socket.io Redis Adapter Connected!");
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    // 서버에 어댑터 장착
    server.adapter(this.adapterConstructor);

    return server;
  }
}
