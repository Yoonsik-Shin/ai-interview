import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { ResumesModule } from "./resumes/resume.module";
import { InterviewModule } from "./interviews/interview.module";

import { UsersModule } from "./users/users.module";

@Module({
    imports: [AuthModule, ResumesModule, InterviewModule, UsersModule],
    exports: [AuthModule, ResumesModule, InterviewModule, UsersModule],
})
export class ModulesModule {}
