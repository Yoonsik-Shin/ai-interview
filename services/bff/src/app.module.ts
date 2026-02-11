import { Module } from "@nestjs/common";
import { ModulesModule } from "./modules/modules.module";
import { CoreModule } from "./core/core.module";
import { InfraModule } from "./infra/infra.module";
@Module({
    imports: [CoreModule, InfraModule, ModulesModule],
})
export class AppModule {}
