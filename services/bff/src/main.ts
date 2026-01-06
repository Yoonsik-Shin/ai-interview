import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cookie Parser 미들웨어 추가
  app.use(cookieParser());

  // CORS 설정
  app.enableCors({
    origin: true, // 모든 origin 허용 (동적으로 설정)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // 전역 예외 필터 적용
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 전역 Validation Pipe 적용
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO에 정의되지 않은 속성 제거
      forbidNonWhitelisted: true, // DTO에 정의되지 않은 속성이 있으면 에러
      transform: true, // 자동 타입 변환
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
