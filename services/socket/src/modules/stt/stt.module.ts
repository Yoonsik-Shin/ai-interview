import { Module } from "@nestjs/common";

import { SttStreamConsumer } from "./consumers/stt-stream.consumer";
import { AudioProcessorService } from "./services/audio-processor.service";
import { SttGrpcService } from "../../infra/grpc/services/stt-grpc.service";
import { SttStorageService } from "../../infra/redis/services/stt-storage.service";

@Module({
    providers: [SttStreamConsumer, AudioProcessorService, SttGrpcService, SttStorageService],
    exports: [AudioProcessorService, SttGrpcService, SttStorageService],
})
export class SttModule {}
