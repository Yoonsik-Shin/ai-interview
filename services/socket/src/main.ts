import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './adapters/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS 설정 (WebSocket을 포함한 모든 요청에 적용)
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // 1. Redis Adapter 인스턴스 생성 및 연결
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();

  // 2. 앱에 어댑터 적용 (WebSocket이 이제 Redis를 통하게 됨)
  app.useWebSocketAdapter(redisIoAdapter);

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();

