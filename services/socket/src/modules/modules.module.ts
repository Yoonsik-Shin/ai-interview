import { Module } from "@nestjs/common";
import { SttModule } from "./stt/stt.module";
import { InterviewModule } from "./interview/interview.module";
import { ConnectionModule } from "./connection/connection.module";
import { ResumeModule } from "./resume/resume.module.js";

@Module({
    imports: [SttModule, InterviewModule, ConnectionModule, ResumeModule],
    exports: [SttModule, InterviewModule, ConnectionModule, ResumeModule],
})
export class ModulesModule {}
