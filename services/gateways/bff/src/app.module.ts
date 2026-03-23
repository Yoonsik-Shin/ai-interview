import { Module } from "@nestjs/common";
import { ModulesModule } from "./modules/modules.module";
import { CoreModule } from "./core/core.module";
import { InfraModule } from "./infra/infra.module";
import { DevToolModule } from "./modules/devtool/devtool.module";
@Module({
    imports: [CoreModule, InfraModule, ModulesModule, DevToolModule],
})
export class AppModule {}
