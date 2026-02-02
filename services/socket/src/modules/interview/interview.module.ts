import { Module } from "@nestjs/common";
import { InterviewGateway } from "./interview.gateway";
import { InterviewConnectionListener } from "./listeners/interview-connection.listener";
import { InterviewSttListener } from "./listeners/interview-stt.listener";
import { TranscriptPubSubConsumer } from "./transcript-pubsub.consumer";
import { ThinkingPubSubConsumer } from "./thinking-pubsub.consumer";
import { AudioPubSubConsumer } from "./audio-pubsub.consumer";
import { SttModule } from "../stt/stt.module";
import { CoreInterviewGrpcService } from "./services/core-interview-grpc.service";

@Module({
    imports: [SttModule],
    providers: [
        InterviewGateway,
        CoreInterviewGrpcService, // Core gRPC Stage 관리 서비스
        InterviewConnectionListener,
        InterviewSttListener,
        TranscriptPubSubConsumer, // LLM 토큰
        ThinkingPubSubConsumer, // LangGraph 노드 (향후)
        AudioPubSubConsumer, // TTS 음성
    ],
})
export class InterviewModule {}
