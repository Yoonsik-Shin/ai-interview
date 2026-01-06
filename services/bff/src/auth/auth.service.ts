import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GrpcCoreAuthClient } from './infrastructure/grpc-core-auth.client';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RedisService } from '../common/redis/redis.service';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    userId: number;
    email: string;
    nickname: string;
    role: string;
  };
}

@Injectable()
export class AuthService {
  private readonly REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7일 (초 단위)

  constructor(
    private readonly grpcCoreAuthClient: GrpcCoreAuthClient,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * 회원가입
   */
  async register(registerDto: RegisterDto): Promise<AuthResult> {
    // 1. Core Service에 회원가입 요청
    await this.grpcCoreAuthClient.signup(
      registerDto.email,
      registerDto.password,
      registerDto.nickname,
    );

    // 2. 사용자 정보 조회 (인증을 통해)
    const validateResponse = await this.grpcCoreAuthClient.validateUser(
      registerDto.email,
      registerDto.password,
    );

    // 3. JWT 토큰 발급
    return this.generateTokens(validateResponse);
  }

  /**
   * 로그인
   */
  async login(loginDto: LoginDto): Promise<AuthResult> {
    // 1. Core Service에 인증 요청
    const validateResponse = await this.grpcCoreAuthClient.validateUser(
      loginDto.email,
      loginDto.password,
    );

    // 2. JWT 토큰 발급
    return this.generateTokens(validateResponse);
  }

  /**
   * Refresh Token으로 Access Token 재발급
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    // 1. Refresh Token 검증
    interface JwtPayload {
      userId: number;
      email: string;
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // 2. Redis에서 Refresh Token 확인
    const storedToken = await this.redisService
      .getClient()
      .get(`refresh_token:${payload.userId}`);
    if (!storedToken || storedToken !== refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    // 3. 새 Access Token 발급
    const accessToken = this.jwtService.sign(
      { userId: payload.userId, email: payload.email },
      { expiresIn: '15m' },
    );

    return { accessToken };
  }

  /**
   * JWT 토큰 생성 및 Refresh Token 저장
   */
  private async generateTokens(user: {
    userId: number;
    email: string;
    nickname: string;
    role: string;
  }): Promise<AuthResult> {
    // Access Token 생성 (15분)
    const accessToken = this.jwtService.sign(
      { userId: user.userId, email: user.email },
      { expiresIn: '15m' },
    );

    // Refresh Token 생성 (7일)
    const refreshToken = this.jwtService.sign(
      { userId: user.userId, email: user.email },
      { expiresIn: '7d' },
    );

    // Refresh Token을 Redis에 저장
    await this.redisService
      .getClient()
      .setex(
        `refresh_token:${user.userId}`,
        this.REFRESH_TOKEN_EXPIRY,
        refreshToken,
      );

    return {
      accessToken,
      refreshToken,
      user: {
        userId: user.userId,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
      },
    };
  }
}
