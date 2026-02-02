import {
    AuthServiceClient,
    AuthenticateUserRequest,
    AuthenticateUserResponse,
    RegisterCandidateRequest,
    RegisterRecruiterRequest,
    RegisterResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
} from "@grpc-types/auth";
import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import type { ClientGrpc } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";

/**
 * onModuleInit 사용 이유:
 * NestJS에서 gRPC Client는 모듈이 완전히 초기화된 후에야 서비스 인스턴스를 가져올 수 있습니다.
 * ClientGrpc.getService()는 모듈 초기화 전에는 undefined를 반환하므로,
 * OnModuleInit 라이프사이클 훅을 사용하여 초기화 후에 서비스를 가져옵니다.
 */
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
