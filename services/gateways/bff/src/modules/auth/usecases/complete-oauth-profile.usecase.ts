import { Injectable } from "@nestjs/common";
import { AuthGrpcService } from "src/infra/grpc/services/auth-grpc.service";

export class CompleteOAuthProfileCommand {
    constructor(
        public readonly pendingToken: string,
        public readonly role: string,
        public readonly phoneNumber: string,
        public readonly nickname: string,
        public readonly password: string,
    ) {}
}

export class CompleteOAuthProfileResult {
    constructor(
        public readonly accessToken: string,
        public readonly refreshToken: string,
        public readonly user: { id: string; email: string; nickname: string; role: string },
    ) {}
}

@Injectable()
export class CompleteOAuthProfileUseCase {
    constructor(private readonly authGrpcService: AuthGrpcService) {}

    async execute(command: CompleteOAuthProfileCommand): Promise<CompleteOAuthProfileResult> {
        const response = await this.authGrpcService.completeOAuthProfile({
            pendingToken: command.pendingToken,
            role: command.role,
            phoneNumber: command.phoneNumber,
            nickname: command.nickname,
            password: command.password,
        });

        return new CompleteOAuthProfileResult(
            response.accessToken,
            response.refreshToken,
            response.user!,
        );
    }
}
