import { Controller, Post, Body, Res, UnauthorizedException, Req } from "@nestjs/common";
import type { Response, Request } from "express";
import { RegisterRequestDto, RegisterRole } from "./dto/request/register-request.dto";
import { LoginRequestDto } from "./dto/request/login-request.dto";
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
import { RefreshTokenUseCase } from "./usecases/refresh-token.usecase";

@Controller({ path: "auth", version: "1" })
export class AuthController {
    constructor(
        private readonly registerCandidateUseCase: RegisterCandidateUseCase,
        private readonly registerRecruiterUseCase: RegisterRecruiterUseCase,
        private readonly loginUseCase: LoginUseCase,
        private readonly refreshTokenUseCase: RefreshTokenUseCase,
    ) {}

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

        const result = await this.refreshTokenUseCase.execute(refreshToken);

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
}
