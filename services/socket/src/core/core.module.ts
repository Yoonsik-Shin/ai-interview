import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { AppConfigModule } from "./config/config.module";
import { HealthModule } from "./health/health.module";
import { LoggingModule } from "./logging/logging.module";
import { AuthModule } from "../modules/auth/auth.module";

@Module({
    imports: [
        AppConfigModule,
        EventEmitterModule.forRoot(),
        AuthModule,
        HealthModule,
        LoggingModule,
    ],
    exports: [AppConfigModule, EventEmitterModule, AuthModule],
})
export class CoreModule {}
