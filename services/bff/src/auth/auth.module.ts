import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GrpcCoreAuthClient } from './infrastructure/grpc-core-auth.client';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [
    RedisModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '15m' },
    }),
    // Auth gRPC 클라이언트 등록
    ClientsModule.register([
      {
        name: 'AUTH_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'auth',
          protoPath: join(__dirname, '../proto/auth.proto'),
          url:
            process.env.CORE_GRPC_URL ||
            (process.env.CORE_GRPC_HOST && process.env.CORE_GRPC_PORT
              ? `${process.env.CORE_GRPC_HOST}:${process.env.CORE_GRPC_PORT}`
              : 'core:9090'),
        },
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, GrpcCoreAuthClient, JwtStrategy, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
