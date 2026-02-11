import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import type { ClientGrpc } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";
import { FindUserByIdRequest, FindUserByIdResponse, UserServiceClient } from "@grpc-types/user";

@Injectable()
export class UserGrpcService implements OnModuleInit {
    private userService: UserServiceClient;

    constructor(
        @Inject("USER_PACKAGE")
        private readonly client: ClientGrpc,
    ) {}

    onModuleInit() {
        this.userService = this.client.getService<UserServiceClient>("UserService");
    }

    async findUserById(request: FindUserByIdRequest): Promise<FindUserByIdResponse> {
        return firstValueFrom(this.userService.findUserById(request));
    }
}
