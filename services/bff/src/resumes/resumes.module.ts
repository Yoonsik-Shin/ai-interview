import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { ResumesController } from './resumes.controller';
import { ResumesService } from './resumes.service';

@Module({
  imports: [
    // Resume gRPC 클라이언트 등록
    ClientsModule.register([
      {
        name: 'RESUME_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'resume',
          protoPath: join(__dirname, '../proto/resume.proto'),
          url:
            process.env.CORE_GRPC_URL ||
            (process.env.CORE_GRPC_HOST && process.env.CORE_GRPC_PORT
              ? `${process.env.CORE_GRPC_HOST}:${process.env.CORE_GRPC_PORT}`
              : 'core:9090'),
        },
      },
    ]),
  ],
  controllers: [ResumesController],
  providers: [ResumesService],
})
export class ResumesModule {}

