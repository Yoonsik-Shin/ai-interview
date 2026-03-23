import { Module } from "@nestjs/common";
import { CoreModule } from "./core/core.module";
import { InfraModule } from "./infra/infra.module";
import { ModulesModule } from "./modules/modules.module";

@Module({
    imports: [CoreModule, InfraModule, ModulesModule],
})
export class AppModule {}
