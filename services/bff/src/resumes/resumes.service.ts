import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, type Observable } from 'rxjs';

interface ResumeServiceGrpc {
  uploadResume(data: {
    userId: number;
    title: string;
    fileData: Buffer;
    fileName: string;
    contentType: string;
  }): Observable<{ resumeId: number }>;
}

/**
 * Resumes Service
 *
 * onModuleInit 사용 이유:
 * NestJS에서 gRPC Client는 모듈이 완전히 초기화된 후에야 서비스 인스턴스를 가져올 수 있습니다.
 * ClientGrpc.getService()는 모듈 초기화 전에는 undefined를 반환하므로,
 * OnModuleInit 라이프사이클 훅을 사용하여 초기화 후에 서비스를 가져옵니다.
 */
@Injectable()
export class ResumesService implements OnModuleInit {
  private resumeService: ResumeServiceGrpc;

  constructor(@Inject('RESUME_PACKAGE') private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.resumeService =
      this.client.getService<ResumeServiceGrpc>('ResumeService');
  }

  async uploadResume(
    userId: number,
    title: string,
    fileData: Buffer,
    fileName: string,
    contentType: string,
  ): Promise<{ resumeId: number }> {
    const response = await firstValueFrom(
      this.resumeService.uploadResume({
        userId,
        title,
        fileData,
        fileName,
        contentType,
      }),
    ) as { resumeId: number };

    return {
      resumeId: Number(response.resumeId),
    };
  }
}
