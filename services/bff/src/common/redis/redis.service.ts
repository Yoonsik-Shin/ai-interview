import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis 서비스
 * 
 * Redis 클라이언트를 싱글톤으로 관리합니다.
 * 애플리케이션 전체에서 하나의 Redis 연결을 공유합니다.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'redis',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });

    this.redis.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.redis.on('connect', () => {
      console.log('Redis Client Connected');
    });
  }

  /**
   * Redis 클라이언트 인스턴스 반환
   */
  getClient(): Redis {
    return this.redis;
  }

  /**
   * 애플리케이션 종료 시 Redis 연결 종료
   */
  onModuleDestroy() {
    this.redis.quit();
  }
}

