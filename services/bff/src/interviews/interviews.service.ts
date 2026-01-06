import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { lastValueFrom, Observable } from 'rxjs';
import type { ClientGrpc } from '@nestjs/microservices';

interface CreateInterviewRequest {
  userId: number;
  resumeId: number;
  domain: string;
  type: string;
  persona: string;
  interviewerCount: number;
  targetDurationMinutes: number;
  selfIntroduction: string;
}

interface CreateInterviewResponse {
  interviewId: string | number;
  status: number;
}

// gRPC 서비스 인터페이스 정의 (proto 파일 내용과 매핑)
// NestJS gRPC는 메서드명을 자동으로 camelCase로 매핑해줍니다.
interface InterviewServiceGrpc {
  createInterview(
    data: CreateInterviewRequest,
  ): Observable<CreateInterviewResponse>;
}

@Injectable()
export class InterviewsService implements OnModuleInit {
  private grpcService: InterviewServiceGrpc;

  constructor(
    // AppModule에서 등록한 클라이언트 주입
    @Inject('INTERVIEW_PACKAGE') private readonly client: ClientGrpc,
  ) {}

  // 모듈이 시작될 때 gRPC 서비스 인스턴스를 가져옵니다.
  onModuleInit() {
    // .proto 파일에 정의된 service 이름과 정확히 일치해야 합니다.
    this.grpcService = this.client.getService<InterviewServiceGrpc>(
      'InterviewServiceGrpc',
    );
  }

  async createInterview(userId: number, dto: CreateInterviewDto) {
    console.log(`BFF: gRPC 요청 전송 시작 (userId: ${userId})`);

    // 1. gRPC로 보낼 페이로드 구성
    // NestJS gRPC 클라이언트가 camelCase(JS) <-> snake_case(Proto) 변환을 자동으로 해줍니다.
    // DTO의 필드명과 proto의 메시지 필드명이 (케이스만 다르고) 일치하면 됩니다.
    const payload = {
      userId, // DTO에는 없지만 추가
      ...dto, // 나머지 DTO 필드들 펼침
    };

    // 2. Core gRPC 서버 호출 (Observable -> Promise 변환)
    // lastValueFrom을 사용해 비동기 응답을 기다립니다.
    try {
      const response = await lastValueFrom(
        this.grpcService.createInterview(payload),
      );
      console.log(
        `BFF: gRPC 응답 수신 완료 (interviewId: ${response.interviewId})`,
      );

      // 3. 클라이언트에게 줄 최종 결과 반환
      return {
        interviewId: Number(response.interviewId),
        status: response.status,
      };
    } catch (error) {
      console.error('BFF: gRPC 호출 중 에러 발생', error);
      // 필요시 HttpException으로 감싸서 던짐
      throw error;
    }
  }
}
