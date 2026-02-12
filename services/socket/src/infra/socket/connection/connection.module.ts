import { Module } from "@nestjs/common";
import { ConnectionGateway } from "./connection.gateway";
import { HandleConnectionUseCase } from "./usecases/handle-connection.usecase";
import { HandleDisconnectUseCase } from "./usecases/handle-disconnect.usecase";

@Module({
    providers: [ConnectionGateway, HandleConnectionUseCase, HandleDisconnectUseCase],
    exports: [ConnectionGateway],
})
export class ConnectionModule {}
