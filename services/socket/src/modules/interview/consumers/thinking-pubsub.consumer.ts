import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { RedisClient } from "../../../infra/redis/redis.clients.js";
import { InterviewGateway } from "../interview.gateway.js";
import {
    SendThinkingNotificationUseCase,
    SendThinkingNotificationCommand,
} from "../usecases/send-thinking-notification.usecase.js";

/**
 * Thinking Pub/Sub Consumer
 * Redis Pub/Sub에서 LangGraph 노드 실행 정보를 subscribe하여 WebSocket으로 전송
 * (향후 LangGraph 통합 시 사용)
 */
@Injectable()
export class ThinkingPubSubConsumer implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(ThinkingPubSubConsumer.name);
    private subscriber: ReturnType<typeof RedisClient.prototype.duplicate>;

    constructor(
        private readonly redisClient: RedisClient,
        private readonly interviewGateway: InterviewGateway,
        private readonly sendThinkingNotificationUseCase: SendThinkingNotificationUseCase,
    ) {}

    async onModuleInit() {
        this.subscriber = this.redisClient.duplicate();

        // Set up message handler before subscribing
        this.subscriber.on("pmessage", (_pattern: string, _channel: string, message: string) => {
            this.handleThinking(message);
        });

        // 패턴 구독: interview:thinking:*
        await this.subscriber.psubscribe("interview:thinking:*");

        this.logger.log("Thinking PubSub Consumer started");
    }

    private handleThinking(message: string) {
        try {
            const payload = JSON.parse(message);
            const interviewId = payload.interviewId;

            if (!interviewId) return;

            void this.sendThinkingNotificationUseCase.execute(
                new SendThinkingNotificationCommand(
                    this.interviewGateway.server,
                    interviewId,
                    payload.nodeName,
                    payload.status,
                    payload.message,
                ),
            );
        } catch (error) {
            this.logger.error(`Thinking handling error: ${error.message}`, error.stack);
        }
    }

    async onModuleDestroy() {
        await this.subscriber.punsubscribe();
        await this.subscriber.quit();
    }
}
