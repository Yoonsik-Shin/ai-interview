import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { AppConfigModule } from "./config/config.module";
import { HealthModule } from "./health/health.module";
import { GlobalExceptionFilter } from "./filters/global-exception.filter";
import { GrpcToHttpInterceptor } from "./interceptors/grpc-to-http.interceptor";
import { TraceIdMiddleware } from "./middleware/trace-id.middleware";

@Module({
    imports: [AppConfigModule, HealthModule],
    providers: [
        {
            provide: APP_FILTER,
            useClass: GlobalExceptionFilter,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: GrpcToHttpInterceptor,
        },
    ],
})
export class CoreModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(TraceIdMiddleware).forRoutes("*");
    }
}
