import {
    AuthServiceClient,
    AuthenticateUserRequest,
    AuthenticateUserResponse,
    RegisterCandidateRequest,
    RegisterRecruiterRequest,
    RegisterResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
} from "@grpc-types/auth/v1/auth";
import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import type { ClientGrpc } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";

@Injectable()
export class AuthGrpcService implements OnModuleInit {
    private authService: AuthServiceClient;

    constructor(
        @Inject("AUTH_PACKAGE")
        private readonly client: ClientGrpc,
    ) {}

    onModuleInit() {
        this.authService = this.client.getService<AuthServiceClient>("AuthService");
    }

    async registerCandidate(request: RegisterCandidateRequest): Promise<RegisterResponse> {
        return firstValueFrom(this.authService.registerCandidate(request));
    }

    async registerRecruiter(request: RegisterRecruiterRequest): Promise<RegisterResponse> {
        return firstValueFrom(this.authService.registerRecruiter(request));
    }

    async authenticateUser(request: AuthenticateUserRequest): Promise<AuthenticateUserResponse> {
        return firstValueFrom(this.authService.authenticateUser(request));
    }

    async refreshToken(request: RefreshTokenRequest): Promise<RefreshTokenResponse> {
        return firstValueFrom(this.authService.refreshToken(request));
    }
}
