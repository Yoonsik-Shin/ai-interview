import { Injectable } from '@nestjs/common';
import { RedisService } from '../common/redis/redis.service';

export interface InterviewSession {
  interviewId: number;
  userId: number;
  step: string;
  history: Array<{ role: string; content: string }>;
}

@Injectable()
export class InterviewSessionService {
  constructor(private readonly redisService: RedisService) {}

  /**
   * 면접 세션 초기화
   */
  async initializeSession(interviewId: number, userId: number): Promise<void> {
    const session: InterviewSession = {
      interviewId,
      userId,
      step: 'intro',
      history: [],
    };

    await this.redisService.getClient().setex(
      `interview:session:${interviewId}`,
      60 * 60, // 1시간
      JSON.stringify(session),
    );
  }

  /**
   * 면접 세션 조회
   */
  async getSession(interviewId: number): Promise<InterviewSession | null> {
    const data = await this.redisService
      .getClient()
      .get(`interview:session:${interviewId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * 대화 히스토리 추가
   */
  async addToHistory(
    interviewId: number,
    role: string,
    content: string,
  ): Promise<void> {
    const session = await this.getSession(interviewId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.history.push({ role, content });

    await this.redisService
      .getClient()
      .setex(
        `interview:session:${interviewId}`,
        60 * 60,
        JSON.stringify(session),
      );
  }
}
