import { Injectable } from "@nestjs/common";
import {
    InterviewGrpcService,
    InterviewStage,
} from "../../../infra/grpc/services/interview-grpc.service";
import { AudioProcessorService } from "../../stt/services/audio-processor.service";
import { RedisClient } from "../../../infra/redis/redis.clients";
import { AudioProcessor, AudioProcessingCommand } from "./audio-processor.interface";

@Injectable()
export class ProcessSelfIntroUseCase implements AudioProcessor {
    constructor(
        private readonly stageService: InterviewGrpcService,
        private readonly audioProcessorService: AudioProcessorService,
        private readonly redisClient: RedisClient,
    ) {}

    async execute(command: AudioProcessingCommand): Promise<void> {
        const { client, payload } = command;
        await this.audioProcessorService.processAudio(client, payload, "SELF_INTRO");

        if (payload.isFinal) {
            const elapsed = await this.getSelfIntroElapsed(payload.interviewId);

            // 90초 초과 시 강제 완료 처리.
            // transitionStage(IN_PROGRESS) 직접 호출 대신 processUserAnswer를 통해 단일 진입점으로 처리.
            // (transitionStage 직접 호출 시 triggerFirstQuestion + processUserAnswer 양쪽에서 LLM이 중복 호출되는 버그 방지)
            if (elapsed >= 90) {
                const userId = command.client.data?.userId || "system";
                await this.stageService.processUserAnswer(
                    payload.interviewId,
                    "(자기소개 시간 초과)",
                    userId,
                );

                const sessionKey = `interview:session:${payload.interviewId}`;
                await this.redisClient.hdel(sessionKey, "selfIntroStart");
                return; // STT 파이프라인 중복 실행 방지
            }
        }
    }

    private async getSelfIntroElapsed(interviewId: string): Promise<number> {
        const sessionKey = `interview:session:${interviewId}`;
        const cachedStart = await this.redisClient.hget(sessionKey, "selfIntroStart");

        let startTime: number;
        if (cachedStart) {
            startTime = Number(cachedStart);
        } else {
            const { selfIntroElapsedSeconds } = await this.stageService.getStage(interviewId);
            startTime =
                selfIntroElapsedSeconds > 0
                    ? Date.now() - selfIntroElapsedSeconds * 1000
                    : Date.now();
            await this.redisClient.hset(sessionKey, "selfIntroStart", startTime);
        }
        return Math.floor((Date.now() - startTime) / 1000);
    }
}
