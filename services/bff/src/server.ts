// import { ExceptionFilter, INestApplication, ValidationPipe } from "@nestjs/common";
// import { ConfigService } from "@nestjs/config";
// import { Server as HttpServer } from "https";
// import { GlobalExceptionFilter } from "./core/filters/global-exception.filter";

// class Server<TServerOptions extends Record<string, any> = Record<string, any>> {
//     private configService: ConfigService;

//     constructor(
//         private app: INestApplication,
//         private options: TServerOptions,
//     ) {
//         this.configService = this.app.get<ConfigService>(ConfigService);
//     }

//     async listen(port: number = this.configService.getOrThrow("PORT")): Promise<void> {
//         this.setCors(this.options.cors);
//         this.setGlobalFilters(this.options.filters);
//         this.setGlobalPipes(this.options.pipes);
//         this.setGlobalPrefix(this.options.prefix);

//         const server: HttpServer = await this.app.listen(port);
//     }

//     private setCors(corsOptions: Record<string, any>): void {
//         this.app.enableCors({
//             origin: true, // 모든 origin 허용 (동적으로 설정)
//             methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
//             allowedHeaders: [
//                 "Content-Type",
//                 "Authorization",
//                 "X-Requested-With",
//                 "Accept",
//                 "Origin",
//             ],
//             credentials: true,
//             preflightContinue: false,
//             optionsSuccessStatus: 204,
//             ...corsOptions,
//         });
//     }

//     private setGlobalFilters(filters: ExceptionFilter[] = []): void {
//         this.app.useGlobalFilters(new GlobalExceptionFilter(), ...filters);
//     }

//     private setGlobalPipes(pipes: any[] = []): void {
//         this.app.useGlobalPipes(
//             new ValidationPipe({
//                 whitelist: true, // DTO에 정의되지 않은 속성 제거
//                 forbidNonWhitelisted: true, // DTO에 정의되지 않은 속성이 있으면 에러
//                 transform: true, // 자동 타입 변환
//             }),
//             ...pipes,
//         );
//     }
// }
