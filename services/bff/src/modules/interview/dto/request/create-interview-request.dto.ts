import {
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Min,
    Max,
    IsArray,
    IsUUID,
} from "class-validator";
import { InterviewType, InterviewRole, InterviewPersonality } from "../../enum/interview.enum";

export class CreateInterviewRequestDto {
    @IsString()
    @IsOptional()
    @IsUUID()
    resumeId?: string;

    @IsString()
    @IsNotEmpty()
    domain: string;

    @IsEnum(InterviewType)
    type: InterviewType;

    @IsArray()
    @IsEnum(InterviewRole, { each: true })
    interviewerRoles: InterviewRole[];

    @IsEnum(InterviewPersonality)
    personality: InterviewPersonality;

    @IsInt()
    @Min(10)
    @Max(120)
    targetDurationMinutes: number;

    @IsString()
    selfIntroduction: string;
}
