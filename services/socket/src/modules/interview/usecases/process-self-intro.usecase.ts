import { Injectable } from "@nestjs/common";
import { Socket } from "socket.io";
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
            const elapsed = await this.getSelfIntroElapsed(payload.interviewSessionId);

            if (elapsed >= 90) {
                await this.transitionAndEmit(
                    client,
                    payload.interviewSessionId,
                    InterviewStage.SELF_INTRO,
                    InterviewStage.IN_PROGRESS,
                    "감사합니다. 충분히 들었습니다. 이제 본격적으로 면접을 시작하겠습니다.",
                );
            } else if (elapsed >= 30) {
                await this.transitionAndEmit(
                    client,
                    payload.interviewSessionId,
                    InterviewStage.SELF_INTRO,
                    InterviewStage.IN_PROGRESS,
                );
            } else {
                await this.handleShortSelfIntro(client, payload.interviewSessionId);
            }
        }
    }

    private async handleShortSelfIntro(client: Socket, interviewSessionId: string): Promise<void> {
        const { selfIntroRetryCount } = await this.stageService.getStage(interviewSessionId);

        if (selfIntroRetryCount < 2) {
            await this.stageService.incrementSelfIntroRetry(interviewSessionId);
            await this.stageService.transitionStage(interviewSessionId, InterviewStage.SELF_INTRO);

            const sessionKey = `interview:session:${interviewSessionId}`;
            await this.redisClient.hset(sessionKey, "selfIntroStart", Date.now());

            client.emit("interview:timer_sync", { timeLeft: 60 });
            client.emit("interview:intervene", {
                message:
                    "조금 더 구체적으로 자기소개를 해주시면 좋겠습니다. 지금까지 하신 말씀 외에 본인의 강점이나 프로젝트 경험을 더 들려주실 수 있을까요? 시간은 충분하니 편안하게 말씀해 주세요.",
            });
        } else {
            await this.transitionAndEmit(
                client,
                interviewSessionId,
                InterviewStage.SELF_INTRO,
                InterviewStage.IN_PROGRESS,
                "네, 감사합니다. 말씀하신 내용을 바탕으로 이제 본격적인 면접을 시작하겠습니다.",
            );
        }
    }

    private async transitionAndEmit(
        client: Socket,
        sessionId: string,
        prev: InterviewStage,
        next: InterviewStage,
        message?: string,
    ): Promise<void> {
        if (message) client.emit("interview:intervene", { message });
        const nextStage = await this.stageService.transitionStage(sessionId, next);
        client.emit("interview:stage_changed", {
            interviewSessionId: sessionId,
            previousStage: prev,
            currentStage: nextStage,
        });
    }

    private async getSelfIntroElapsed(interviewSessionId: string): Promise<number> {
        const sessionKey = `interview:session:${interviewSessionId}`;
        const cachedStart = await this.redisClient.hget(sessionKey, "selfIntroStart");

        let startTime: number;
        if (cachedStart) {
            startTime = Number(cachedStart);
        } else {
            const { selfIntroElapsedSeconds } =
                await this.stageService.getStage(interviewSessionId);
            startTime =
                selfIntroElapsedSeconds > 0
                    ? Date.now() - selfIntroElapsedSeconds * 1000
                    : Date.now();
            await this.redisClient.hset(sessionKey, "selfIntroStart", startTime);
        }
        return Math.floor((Date.now() - startTime) / 1000);
    }
}
