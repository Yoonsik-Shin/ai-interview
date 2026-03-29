import { Module } from "@nestjs/common";
import { SttModule } from "./stt/stt.module";
import { InterviewModule } from "./interview/interview.module";
import { ConnectionModule } from "../infra/socket/connection/connection.module";
import { ResumeModule } from "./resume/resume.module.js";
import { DebugTraceModule } from "./debug/debug-trace.module";

@Module({
    imports: [SttModule, InterviewModule, ConnectionModule, ResumeModule, DebugTraceModule],
    exports: [SttModule, InterviewModule, ConnectionModule, ResumeModule, DebugTraceModule],
})
export class ModulesModule {}
