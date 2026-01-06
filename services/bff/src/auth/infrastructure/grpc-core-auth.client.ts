import { Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

/**
 * Core Service의 Auth gRPC 클라이언트
 *
 * Infrastructure Layer: 외부 서비스(Core)와의 통신을 담당하는 어댑터
 *
 * onModuleInit 사용 이유:
 * NestJS에서 gRPC Client는 모듈이 완전히 초기화된 후에야 서비스 인스턴스를 가져올 수 있습니다.
 * ClientGrpc.getService()는 모듈 초기화 전에는 undefined를 반환하므로,
 * OnModuleInit 라이프사이클 훅을 사용하여 초기화 후에 서비스를 가져옵니다.
 */
@Injectable()
export class GrpcCoreAuthClient implements OnModuleInit {
  private authService: any;

  constructor(@Inject('AUTH_PACKAGE') private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.authService = this.client.getService('AuthService');
  }

  /**
   * 회원가입
   */
  async signup(
    email: string,
    password: string,
    nickname: string,
  ): Promise<{ userId: number }> {
    return firstValueFrom(
      this.authService.signup({ email, password, nickname }),
    );
  }

  /**
   * 사용자 인증
   */
  async validateUser(
    email: string,
    password: string,
  ): Promise<{
    userId: number;
    email: string;
    nickname: string;
    role: string;
  }> {
    return firstValueFrom(this.authService.validateUser({ email, password }));
  }
}
