import { Module } from "@nestjs/common";
import { InterviewGateway } from "./interview.gateway";
import { InterviewConnectionListener } from "./listeners/interview-connection.listener";
import { InterviewSttListener } from "./listeners/interview-stt.listener";
import { TranscriptPubSubConsumer } from "./consumers/transcript-pubsub.consumer";
import { ThinkingPubSubConsumer } from "./consumers/thinking-pubsub.consumer";
import { AudioPubSubConsumer } from "./consumers/audio-pubsub.consumer";
import { StoragePubSubConsumer } from "./consumers/storage-pubsub.consumer";
import { SttModule } from "../stt/stt.module";
import { InterviewGrpcService } from "../../infra/grpc/services/interview-grpc.service";
import { RedisModule } from "../../infra/redis/redis.module";

import { SyncStageUseCase } from "./usecases/sync-stage.usecase";
import { ProcessCandidateGreetingUseCase } from "./usecases/process-candidate-greeting.usecase";
import { ProcessSelfIntroUseCase } from "./usecases/process-self-intro.usecase";
import { ProcessNormalQAUseCase } from "./usecases/process-normal-qa.usecase";
import { ProcessLastAnswerUseCase } from "./usecases/process-last-answer.usecase";
import { ProcessClosingGreetingUseCase } from "./usecases/process-closing-greeting.usecase";
import { AudioProcessorFactory } from "./usecases/audio-processor.factory";
import { SendSttResultUseCase } from "./usecases/send-stt-result.usecase";
import { SendTranscriptUseCase } from "./usecases/send-transcript.usecase";
import { SendThinkingNotificationUseCase } from "./usecases/send-thinking-notification.usecase";
import { SendAudioDataUseCase } from "./usecases/send-audio-data.usecase";

@Module({
    imports: [SttModule, RedisModule],
    providers: [
        InterviewGateway,
        InterviewGrpcService,
        SyncStageUseCase,
        ProcessCandidateGreetingUseCase,
        ProcessSelfIntroUseCase,
        ProcessNormalQAUseCase,
        ProcessLastAnswerUseCase,
        ProcessClosingGreetingUseCase,
        AudioProcessorFactory,
        SendSttResultUseCase,
        SendTranscriptUseCase,
        SendThinkingNotificationUseCase,
        SendAudioDataUseCase,
        InterviewConnectionListener,
        InterviewSttListener,
        TranscriptPubSubConsumer,
        ThinkingPubSubConsumer,
        AudioPubSubConsumer,
        StoragePubSubConsumer,
    ],
})
export class InterviewModule {}
