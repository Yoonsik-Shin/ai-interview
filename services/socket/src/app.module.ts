import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { CoreModule } from "./core/core.module";
import { InfrastructureModule } from "./infrastructure/infrastructure.module";
import { ModulesModule } from "./modules/modules.module";

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventEmitterModule.forRoot(), //
        CoreModule,
        InfrastructureModule,
        ModulesModule,
    ],
})
export class AppModule {}
