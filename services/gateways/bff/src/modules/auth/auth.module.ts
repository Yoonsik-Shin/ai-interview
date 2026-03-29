import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { GoogleStrategy } from "./strategies/google.strategy";
import { RegisterCandidateUseCase } from "./usecases/register-candidate.usecase";
import { LoginUseCase } from "./usecases/login.usecase";
import { RefreshTokenUseCase } from "./usecases/refresh-token.usecase";
import { RegisterRecruiterUseCase } from "./usecases/register-recruiter.usecase";
import { LoginWithOAuthUseCase } from "./usecases/login-with-oauth.usecase";
import { CompleteOAuthProfileUseCase } from "./usecases/complete-oauth-profile.usecase";
import { OAuthLoginHelper } from "./helpers/oauth-login.helper";

@Module({
    imports: [PassportModule],
    controllers: [AuthController],
    providers: [
        JwtStrategy,
        JwtAuthGuard,
        GoogleStrategy,
        RegisterCandidateUseCase,
        LoginUseCase,
        RefreshTokenUseCase,
        RegisterRecruiterUseCase,
        LoginWithOAuthUseCase,
        CompleteOAuthProfileUseCase,
        OAuthLoginHelper,
    ],
    exports: [JwtAuthGuard],
})
export class AuthModule {}
