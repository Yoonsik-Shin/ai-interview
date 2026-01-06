import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { InterviewsController } from './interviews/interviews.controller';
import { InterviewsService } from './interviews/interviews.service';

@Module({
  imports: [
    // 🔥 핵심: gRPC 클라이언트 등록
    ClientsModule.register([
      {
        name: 'INTERVIEW_PACKAGE', // 이 이름으로 서비스를 주입받습니다.
        transport: Transport.GRPC,
        options: {
          package: 'interview', // .proto 파일에 적힌 package 이름
          protoPath: join(__dirname, './proto/interview.proto'), // .proto 파일 실제 경로
          // ⭐ Core 서버 주소 (환경변수로 설정 가능)
          url: process.env.CORE_GRPC_URL || 
               (process.env.CORE_GRPC_HOST && process.env.CORE_GRPC_PORT 
                 ? `${process.env.CORE_GRPC_HOST}:${process.env.CORE_GRPC_PORT}`
                 : 'core:9090'),
        },
      },
    ]),
  ],
  controllers: [AppController, InterviewsController],
  providers: [AppService, InterviewsService],
})
export class AppModule {}
