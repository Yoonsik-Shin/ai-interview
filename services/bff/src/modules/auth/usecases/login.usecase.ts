import { Injectable } from "@nestjs/common";
import { AuthGrpcService } from "src/core/grpc-client/services/auth-grpc.service";

export class LoginCommand {
    constructor(
        public readonly email: string,
        public readonly password: string,
    ) {}
}

export class LoginResult {
    constructor(
        public readonly accessToken: string,
        public readonly refreshToken: string,
        public readonly user: {
            id: string;
            email: string;
            nickname: string;
            role: string;
        },
    ) {}
}

@Injectable()
export class LoginUseCase {
    constructor(private readonly authGrpcService: AuthGrpcService) {}

    async execute(command: LoginCommand): Promise<LoginResult> {
        const response = await this.authGrpcService.authenticateUser({
            email: command.email,
            password: command.password,
        });

        return new LoginResult(response.accessToken, response.refreshToken, response.user!);
    }
}
