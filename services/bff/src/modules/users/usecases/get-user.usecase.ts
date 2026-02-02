import { Injectable, NotFoundException } from "@nestjs/common";
import { UserGrpcService } from "src/core/grpc-client/services/user-grpc.service";

export class GetUserResult {
    constructor(
        public readonly id: string,
        public readonly email: string,
        public readonly nickname: string,
        public readonly role: string,
        public readonly phoneNumber?: string,
        public readonly companyCode?: string,
    ) {}
}

@Injectable()
export class GetUserUseCase {
    constructor(private readonly userGrpcService: UserGrpcService) {}

    async execute(userId: string): Promise<GetUserResult> {
        const response = await this.userGrpcService.findUserById(userId);

        if (response.candidate) {
            const user = response.candidate;
            return new GetUserResult(
                user.id,
                user.email,
                user.nickname,
                user.role,
                user.phoneNumber,
                undefined,
            );
        } else if (response.recruiter) {
            const user = response.recruiter;
            return new GetUserResult(
                user.id,
                user.email,
                user.nickname,
                user.role,
                user.phoneNumber,
                user.companyCode,
            );
        }

        throw new NotFoundException("User not found");
    }
}
