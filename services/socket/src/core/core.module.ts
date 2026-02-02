import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { HealthModule } from "./health/health.module";
import { LoggingModule } from "./logging/logging.module";

@Module({
    imports: [
        JwtModule.register({}), //
        HealthModule,
        LoggingModule,
    ],
})
export class CoreModule {}
