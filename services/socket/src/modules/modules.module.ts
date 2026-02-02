import { Module } from "@nestjs/common";
import { SttModule } from "./stt/stt.module";
import { InterviewModule } from "./interview/interview.module";
import { ConnectionModule } from "./connection/connection.module";

@Module({
    imports: [SttModule, InterviewModule, ConnectionModule],
    exports: [SttModule, InterviewModule, ConnectionModule],
})
export class ModulesModule {}
