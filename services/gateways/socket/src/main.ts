import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { AuthenticatedSocketAdapter } from "./infra/socket/authenticated-socket.adapter";
import { GlobalWsExceptionFilter } from "./core/filters/global-ws-exception.filter";

import { RedisClient } from "./infra/redis/redis.clients";

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // CORS 설정 (WebSocket을 포함한 모든 요청에 적용)
    app.enableCors({
        origin: "*",
        methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
        credentials: true,
    });

    // 1. Redis Adapter 인스턴스 생성 및 연결 (보안 기능 추가됨)
    const redisIoAdapter = new AuthenticatedSocketAdapter(app);
    try {
        const redisClient = app.get(RedisClient);
        const pubClient = redisClient;
        const subClient = redisClient.duplicate();

        redisIoAdapter.connectToRedis(pubClient, subClient);
        // 2. 앱에 어댑터 적용 (WebSocket이 이제 Redis를 통하게 됨)
        app.useWebSocketAdapter(redisIoAdapter);

        // 전역 예외 필터 등록
        app.useGlobalFilters(new GlobalWsExceptionFilter());
    } catch (error) {
        // Redis 연결 실패 시에도 앱은 시작되지만, 멀티 인스턴스 간 메시지 브로드캐스팅이 작동하지 않음
        console.error("❌ Redis Adapter 연결 실패. WebSocket 기능이 제한될 수 있습니다:", error);
        throw error; // 앱 시작을 중단하여 문제를 명확히 알림
    }

    const configService = app.get(ConfigService);
    const port = configService.getOrThrow<number>("PORT");
    await app.listen(port);
}

void bootstrap();
