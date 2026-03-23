import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RegisterCandidateUseCase } from "./usecases/register-candidate.usecase";
import { LoginUseCase } from "./usecases/login.usecase";
import { RefreshTokenUseCase } from "./usecases/refresh-token.usecase";
import { RegisterRecruiterUseCase } from "./usecases/register-recruiter.usecase";

@Module({
    imports: [PassportModule],
    controllers: [AuthController],
    providers: [
        JwtStrategy,
        JwtAuthGuard,
        RegisterCandidateUseCase,
        LoginUseCase,
        RefreshTokenUseCase,
        RegisterRecruiterUseCase,
    ],
    exports: [JwtAuthGuard],
})
export class AuthModule {}
