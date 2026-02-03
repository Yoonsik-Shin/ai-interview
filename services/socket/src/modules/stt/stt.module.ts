import { Module } from "@nestjs/common";

import { SttStreamConsumer } from "./consumers/stt-stream.consumer";
import { ProcessAudioService } from "./services/process-audio.service";
import { SttGrpcService } from "./services/stt-grpc.service";
import { SttStorageService } from "./services/stt-storage.service";

@Module({
    providers: [SttStreamConsumer, ProcessAudioService, SttGrpcService, SttStorageService],
    exports: [ProcessAudioService, SttGrpcService, SttStorageService],
})
export class SttModule {}
