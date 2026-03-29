import { Controller, Post, Get, Body, Res, UnauthorizedException, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import type { Response, Request } from "express";
import { RegisterRequestDto } from "./dto/request/register-request.dto";
import { RegisterRole } from "./enum/auth.enum";
import { LoginRequestDto } from "./dto/request/login-request.dto";
import { CompleteOAuthProfileRequestDto } from "./dto/request/complete-oauth-profile-request.dto";
import {
    RegisterCandidateCommand,
    RegisterCandidateResult,
    RegisterCandidateUseCase,
} from "./usecases/register-candidate.usecase";
import {
    RegisterRecruiterCommand,
    RegisterRecruiterResult,
    RegisterRecruiterUseCase,
} from "./usecases/register-recruiter.usecase";
import { RegisterResponseDto } from "./dto/response/register-response.dto";
import { LoginUseCase } from "./usecases/login.usecase";
import { LoginResponseDto } from "./dto/response/login-response.dto";
import { RefreshTokenCommand, RefreshTokenUseCase } from "./usecases/refresh-token.usecase";
import {
    CompleteOAuthProfileCommand,
    CompleteOAuthProfileUseCase,
} from "./usecases/complete-oauth-profile.usecase";
import { OAuthLoginHelper } from "./helpers/oauth-login.helper";
import { GoogleOAuthUser } from "./strategies/google.strategy";

@Controller({ path: "auth", version: "1" })
export class AuthController {
    constructor(
        private readonly registerCandidateUseCase: RegisterCandidateUseCase,
        private readonly registerRecruiterUseCase: RegisterRecruiterUseCase,
        private readonly loginUseCase: LoginUseCase,
        private readonly refreshTokenUseCase: RefreshTokenUseCase,
        private readonly completeOAuthProfileUseCase: CompleteOAuthProfileUseCase,
        private readonly oAuthLoginHelper: OAuthLoginHelper,
    ) {}

    @UseGuards(ThrottlerGuard)
    @Throttle({ short: { limit: 5, ttl: 60000 }, long: { limit: 20, ttl: 3600000 } })
    @Post("register")
    async register(@Body() requestDto: RegisterRequestDto): Promise<RegisterResponseDto> {
        let result: RegisterCandidateResult | RegisterRecruiterResult;

        switch (requestDto.role) {
            case RegisterRole.Candidate:
                result = await this.registerCandidateUseCase.execute(
                    new RegisterCandidateCommand(
                        requestDto.email,
                        requestDto.password,
                        requestDto.role,
                        requestDto.nickname,
                        requestDto.phoneNumber,
                    ),
                );
                break;
            case RegisterRole.Recruiter:
                result = await this.registerRecruiterUseCase.execute(
                    new RegisterRecruiterCommand(
                        requestDto.email,
                        requestDto.password,
                        requestDto.role,
                        requestDto.nickname,
                        requestDto.phoneNumber,
                        requestDto.companyCode,
                    ),
                );
                break;
            default:
                throw new UnauthorizedException("Invalid role");
        }

        return new RegisterResponseDto(result);
    }

    @UseGuards(ThrottlerGuard)
    @Throttle({ short: { limit: 10, ttl: 60000 }, long: { limit: 50, ttl: 3600000 } })
    @Post("login")
    async login(
        @Body() requestDto: LoginRequestDto,
        @Res({ passthrough: true }) response: Response,
    ): Promise<LoginResponseDto> {
        const result = await this.loginUseCase.execute(requestDto);

        // TODO: Secure, HttpOnly 옵션 설정
        response.cookie("refreshToken", result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
        });

        return new LoginResponseDto(result);
    }

    @Post("refresh")
    async refreshToken(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
        const refreshToken = request.cookies["refreshToken"];

        if (!refreshToken) {
            throw new UnauthorizedException("Refresh token is required");
        }

        const result = await this.refreshTokenUseCase.execute(
            new RefreshTokenCommand(refreshToken),
        );

        response.cookie("refreshToken", result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
        });

        return {
            accessToken: result.accessToken,
        };
    }

    @Post("logout")
    logout(@Res({ passthrough: true }) response: Response) {
        response.clearCookie("refreshToken", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
        });

        return { message: "Logged out successfully" };
    }

    @Get("google")
    @UseGuards(AuthGuard("google"))
    googleLogin(): void {
        // Passport가 Google OAuth 페이지로 리다이렉트 처리
    }

    @Get("google/callback")
    @UseGuards(AuthGuard("google"))
    async googleCallback(
        @Req() req: Request & { user: GoogleOAuthUser },
        @Res() res: Response,
    ): Promise<void> {
        return this.oAuthLoginHelper.handleOAuthCallback(req.user, res);
    }

    @Post("oauth/complete-profile")
    async completeOAuthProfile(
        @Body() dto: CompleteOAuthProfileRequestDto,
        @Res({ passthrough: true }) res: Response,
    ): Promise<LoginResponseDto> {
        const result = await this.completeOAuthProfileUseCase.execute(
            new CompleteOAuthProfileCommand(
                dto.pendingToken,
                dto.role,
                dto.phoneNumber,
                dto.nickname,
                dto.password,
            ),
        );

        res.cookie("refreshToken", result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return new LoginResponseDto(result);
    }
}
