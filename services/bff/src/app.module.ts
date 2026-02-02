import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { ModulesModule } from "./modules/modules.module";
import { CoreModule } from "./core/core.module";
@Module({
    imports: [CoreModule, ModulesModule],
    controllers: [AppController],
})
export class AppModule {}
