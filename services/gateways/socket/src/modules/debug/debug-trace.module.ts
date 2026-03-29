import { Module, Global } from "@nestjs/common";
import { DebugTraceGateway } from "./debug-trace.gateway";
import { SentenceStreamConsumer } from "./sentence-stream.consumer";

@Global()
@Module({
    providers: [DebugTraceGateway, SentenceStreamConsumer],
    exports: [DebugTraceGateway],
})
export class DebugTraceModule {}
