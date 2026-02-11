import { Injectable } from "@nestjs/common";
import { AuthGrpcService } from "src/infra/grpc/services/auth-grpc.service";

export class RegisterCandidateCommand {
    constructor(
        public readonly email: string,
        public readonly password: string,
        public readonly role: string,
        public readonly nickname: string,
        public readonly phoneNumber: string | undefined,
    ) {}
}

export class RegisterCandidateResult {
    constructor(public readonly userId: string) {}
}

@Injectable()
export class RegisterCandidateUseCase {
    constructor(private readonly authGrpcService: AuthGrpcService) {}

    async execute(command: RegisterCandidateCommand): Promise<RegisterCandidateResult> {
        const response = await this.authGrpcService.registerCandidate({
            email: command.email,
            password: command.password,
            role: command.role,
            nickname: command.nickname,
            phoneNumber: command.phoneNumber,
        });

        return new RegisterCandidateResult(response.userId);
    }
}
