import { Module } from "@nestjs/common";
import { SttPubSubConsumer } from "./consumers/stt-pubsub.consumer";
import { SttStreamConsumer } from "./consumers/stt-stream.consumer";
import { ProcessAudioService } from "./services/process-audio.service";
import { SttGrpcService } from "./services/stt-grpc.service";
import { SttStorageService } from "./services/stt-storage.service";

@Module({
    providers: [
        SttPubSubConsumer,
        SttStreamConsumer,
        ProcessAudioService,
        SttGrpcService,
        SttStorageService,
    ],
    exports: [ProcessAudioService, SttGrpcService, SttStorageService],
})
export class SttModule {}
