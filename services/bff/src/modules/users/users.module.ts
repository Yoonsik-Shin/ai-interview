import { Module } from "@nestjs/common";
import { GrpcClientModule } from "src/core/grpc-client/grpc-client.module";
import { UsersController } from "./users.controller";
import { GetUserUseCase } from "./usecases/get-user.usecase";

@Module({
    imports: [GrpcClientModule],
    controllers: [UsersController],
    providers: [GetUserUseCase],
})
export class UsersModule {}
