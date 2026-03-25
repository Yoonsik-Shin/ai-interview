import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import redoc from "redoc-express";
import { AppModule } from "./app.module";
import { RequestMethod, ValidationPipe, VersioningType } from "@nestjs/common";
import cookieParser from "cookie-parser";

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // 글로벌 prefix를 'api'로 설정
    app.setGlobalPrefix("api", {
        exclude: [
            { path: "health/liveness", method: RequestMethod.GET },
            { path: "health/readiness", method: RequestMethod.GET },
        ],
    });

    // NestJS 내장 버저닝 기능 활성화 (URI 방식)
    app.enableVersioning({
        type: VersioningType.URI,
        prefix: "v",
        defaultVersion: "1",
    });

    app.use(cookieParser());

    app.enableCors({
        origin: ["https://unbrdn.me", "https://www.unbrdn.me", "http://localhost:5173"],
        methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
        credentials: true,
        preflightContinue: false,
        optionsSuccessStatus: 204,
    });

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true, // DTO에 정의되지 않은 속성 제거
            forbidNonWhitelisted: true, // DTO에 정의되지 않은 속성이 있으면 에러
            transform: true, // 자동 타입 변환
        }),
    );

    const config = new DocumentBuilder()
        .setTitle("AI Interview BFF API")
        .setDescription("AI Interview BFF Service API Documentation")
        .setVersion("1.0")
        .addBearerAuth()
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api-docs", app, document);

    const httpAdapter = app.getHttpAdapter();
    httpAdapter.get("/api-docs-json", (req, res) => {
        res.json(document);
    });
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
    httpAdapter.get("/docs", redoc(redocOptions));

    await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((err) => {
    console.error("Error during application bootstrap:", err);
    process.exit(1);
});
