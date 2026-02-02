import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import redoc from "redoc-express";
import { AppModule } from "./app.module";
import { RequestMethod, ValidationPipe, VersioningType } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { GlobalExceptionFilter } from "./core/filters/global-exception.filter";
import { traceIdMiddleware } from "./core/middleware/trace-id.middleware";
import { GrpcToHttpInterceptor } from "./core/interceptors/grpc-to-http.interceptor";

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // 글로벌 prefix를 'api'로 설정
    app.setGlobalPrefix("api", {
        exclude: [
            { path: "health/liveness", method: RequestMethod.GET },
            { path: "health/readiness", method: RequestMethod.GET },
            { path: "test-client", method: RequestMethod.GET },
        ],
    });

    // NestJS 내장 버저닝 기능 활성화 (URI 방식)
    app.enableVersioning({
        type: VersioningType.URI,
        prefix: "v",
        defaultVersion: "1",
    });

    // Cookie Parser 미들웨어 추가
    app.use(cookieParser());

    // Trace ID 미들웨어 추가
    app.use(traceIdMiddleware);

    // CORS 설정
    app.enableCors({
        origin: true, // 모든 origin 허용 (동적으로 설정)
        methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
        credentials: true,
        preflightContinue: false,
        optionsSuccessStatus: 204,
    });

    // gRPC 에러를 HTTP 에러로 변환하는 Interceptor (GlobalExceptionFilter보다 먼저 실행되어야 함)
    app.useGlobalInterceptors(new GrpcToHttpInterceptor());

    app.useGlobalFilters(
        new GlobalExceptionFilter(), // 전역 예외 필터 적용 (HTTP)
    );

    // 전역 Validation Pipe 적용
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true, // DTO에 정의되지 않은 속성 제거
            forbidNonWhitelisted: true, // DTO에 정의되지 않은 속성이 있으면 에러
            transform: true, // 자동 타입 변환
        }),
    );

    // Swagger 설정
    const config = new DocumentBuilder()
        .setTitle("AI Interview BFF API")
        .setDescription("AI Interview BFF Service API Documentation")
        .setVersion("1.0")
        .addBearerAuth()
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api-docs", app, document);

    // Swagger JSON endpoint for Redoc
    const httpAdapter = app.getHttpAdapter();
    httpAdapter.get("/api-docs-json", (req, res) => {
        res.json(document);
    });

    // Redoc 설정
    const redocOptions = {
        title: "AI Interview API Docs",
        version: "1.0",
        specUrl: "/api-docs-json",
        theme: {
            colors: {
                primary: {
                    main: "#32329f",
                },
            },
        },
    };

    // Redoc 미들웨어 적용
    httpAdapter.get("/docs", redoc(redocOptions));

    await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((err) => {
    console.error("Error during application bootstrap:", err);
    process.exit(1);
});
