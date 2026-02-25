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

            // 90초 초과 시 강제로 IN_PROGRESS로 넘어감.
            // VAD가 90초 타이머에 의해 멈췄을 때 발화가 0자이면 Core 로직이 안 돌기 때문에 Socket에서 확실히 넘겨줌.
            if (elapsed >= 90) {
                await this.stageService.transitionStage(
                    payload.interviewId,
                    InterviewStage.IN_PROGRESS,
                );

                const sessionKey = `interview:session:${payload.interviewId}`;
                await this.redisClient.hdel(sessionKey, "selfIntroStart");
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
