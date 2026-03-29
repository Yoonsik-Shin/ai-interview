import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { ModulesModule } from "./modules/modules.module";
import { CoreModule } from "./core/core.module";
import { InfraModule } from "./infra/infra.module";
import { DevToolModule } from "./modules/devtool/devtool.module";

@Module({
    imports: [
        ThrottlerModule.forRoot([
            { name: "short", ttl: 60000, limit: 10 },
            { name: "long", ttl: 3600000, limit: 50 },
        ]),
        CoreModule,
        InfraModule,
        ModulesModule,
        DevToolModule,
    ],
})
export class AppModule {}
