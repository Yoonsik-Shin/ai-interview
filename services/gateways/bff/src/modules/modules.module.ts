import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { ResumeModule } from "./resume/resume.module";
import { InterviewModule } from "./interview/interview.module";
import { UserModule } from "./user/user.module";

@Module({
    imports: [AuthModule, ResumeModule, InterviewModule, UserModule],
    exports: [AuthModule, ResumeModule, InterviewModule, UserModule],
})
export class ModulesModule {}
