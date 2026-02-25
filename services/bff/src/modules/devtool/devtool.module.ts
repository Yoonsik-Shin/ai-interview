import { Module } from "@nestjs/common";
import { DevToolController } from "./devtool.controller";
import { ForceStageUseCase } from "./usecases/force-stage.usecase";
import { DevToolGuard } from "../../guards/devtool.guard";
import { GrpcModule } from "../../infra/grpc/grpc.module";

@Module({
    imports: [GrpcModule],
    controllers: [DevToolController],
    providers: [ForceStageUseCase, DevToolGuard],
})
export class DevToolModule {}
