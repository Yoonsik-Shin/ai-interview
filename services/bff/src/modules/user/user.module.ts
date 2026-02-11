import { Module } from "@nestjs/common";
import { UserController } from "./user.controller";
import { GetUserUseCase } from "./usecases/get-user.usecase";

@Module({
    controllers: [UserController],
    providers: [GetUserUseCase],
})
export class UserModule {}
