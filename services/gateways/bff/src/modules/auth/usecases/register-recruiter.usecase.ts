import { Injectable } from "@nestjs/common";
import { AuthGrpcService } from "src/infra/grpc/services/auth-grpc.service";

export class RegisterRecruiterCommand {
    constructor(
        public readonly email: string,
        public readonly password: string,
        public readonly role: string,
        public readonly nickname: string,
        public readonly companyCode: string | undefined,
        public readonly phoneNumber: string | undefined,
    ) {}
}

export class RegisterRecruiterResult {
    constructor(public readonly userId: string) {}
}

@Injectable()
export class RegisterRecruiterUseCase {
    constructor(private readonly authGrpcService: AuthGrpcService) {}

    async execute(command: RegisterRecruiterCommand): Promise<RegisterRecruiterResult> {
        const response = await this.authGrpcService.registerRecruiter({
            email: command.email,
            password: command.password,
            nickname: command.nickname,
            companyCode: command.companyCode ?? "",
            phoneNumber: command.phoneNumber ?? "",
        });

        return new RegisterRecruiterResult(response.userId);
    }
}
