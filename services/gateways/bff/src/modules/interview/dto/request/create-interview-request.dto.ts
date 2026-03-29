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
import {
    InterviewType,
    InterviewRole,
    InterviewPersonality,
    InterviewRound,
} from "../../enum/interview.enum";

export class CreateInterviewRequestDto {
    @IsString()
    @IsOptional()
    @IsUUID()
    resumeId?: string;

    @IsString()
    @IsOptional()
    companyName?: string;

    @IsString()
    @IsNotEmpty()
    domain: string;

    @IsEnum(InterviewType)
    type: InterviewType;

    @IsArray()
    @IsEnum(InterviewRole, { each: true })
    participatingPersonas: InterviewRole[];

    @IsEnum(InterviewPersonality)
    personality: InterviewPersonality;

    @IsEnum(InterviewRound)
    round: InterviewRound;

    @IsString()
    @IsOptional()
    jobPostingUrl?: string;

    @IsInt()
    @Min(10)
    @Max(120)
    scheduledDurationMinutes: number;

}
