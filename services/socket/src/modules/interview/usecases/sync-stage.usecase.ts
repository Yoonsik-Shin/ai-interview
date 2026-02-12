import { Injectable } from "@nestjs/common";
import {
    InterviewGrpcService,
    InterviewStage,
} from "../../../infra/grpc/services/interview-grpc.service";
import { RedisClient } from "../../../infra/redis/redis.clients";
import { AuthenticatedSocket } from "../../../types/socket.types";

export class SyncStageCommand {
    constructor(
        public readonly client: AuthenticatedSocket,
        public readonly interviewSessionId: string,
        public readonly currentStage: InterviewStage,
        public readonly targetStage?: InterviewStage, // Explicit target for skip/debug
        public readonly action: "READY" | "SKIP" | "DEBUG_SKIP" = "READY",
    ) {}
}

export class SyncStageResult {
    constructor(
        public readonly previousStage: InterviewStage,
        public readonly currentStage: InterviewStage,
        public readonly isIntervened: boolean = false,
        public readonly interventionMessage?: string,
    ) {}
}

@Injectable()
export class SyncStageUseCase {
    constructor(
        private readonly stageService: InterviewGrpcService,
        private readonly redisClient: RedisClient,
    ) {}

    async execute(command: SyncStageCommand): Promise<SyncStageResult> {
        let nextStage: InterviewStage | null = null;
        let isIntervened = false;
        let interventionMessage: string | undefined;

        if (command.action === "READY") {
            nextStage = this.getNextStageByReady(command.currentStage);
        } else if (command.action === "SKIP") {
            if (command.currentStage === InterviewStage.SELF_INTRO) {
                nextStage = InterviewStage.IN_PROGRESS;
                isIntervened = true;
                interventionMessage = "자기소개를 건너뛰고 바로 면접을 시작하겠습니다.";

                const userId = command.client.data.userId || "unknown";
                await this.stageService.processUserAnswer(
                    command.interviewSessionId,
                    "(자기소개 생략)",
                    userId,
                );
            }
        } else if (command.action === "DEBUG_SKIP") {
            nextStage = command.targetStage || null;
        }

        if (!nextStage) {
            return new SyncStageResult(command.currentStage, command.currentStage);
        }

        const transitionedStage = await this.stageService.transitionStage(
            command.interviewSessionId,
            nextStage,
        );

        // Redis Optimization: SELF_INTRO 시작 시 시간 기록
        if (transitionedStage === InterviewStage.SELF_INTRO) {
            const sessionKey = `interview:session:${command.interviewSessionId}`;
            await this.redisClient.hset(sessionKey, "selfIntroStart", Date.now());
            await this.redisClient.expire(sessionKey, 3600);
        }

        return new SyncStageResult(
            command.currentStage,
            transitionedStage,
            isIntervened,
            interventionMessage,
        );
    }

    private getNextStageByReady(current: InterviewStage): InterviewStage | null {
        switch (current) {
            case InterviewStage.GREETING:
                return InterviewStage.CANDIDATE_GREETING;
            case InterviewStage.INTERVIEWER_INTRO:
                return InterviewStage.SELF_INTRO_PROMPT;
            case InterviewStage.SELF_INTRO_PROMPT:
                return InterviewStage.SELF_INTRO;
            default:
                return null;
        }
    }
}
