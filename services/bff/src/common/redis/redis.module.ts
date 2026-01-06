import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Redis 모듈
 * 
 * Global 모듈로 설정하여 모든 모듈에서 주입받을 수 있도록 합니다.
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}

