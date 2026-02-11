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

// .proto의 Enum 값과 문자열이 일치해야 합니다.
export enum InterviewType {
    REAL = "REAL",
    PRACTICE = "PRACTICE",
}

export enum InterviewRole {
    TECH = "TECH",
    HR = "HR",
    LEADER = "LEADER",
}

export enum InterviewPersonality {
    PRESSURE = "PRESSURE",
    COMFORTABLE = "COMFORTABLE",
    RANDOM = "RANDOM",
}

export class CreateInterviewDto {
    // userId는 토큰에서 추출하므로 여기선 제외 (일단 하드코딩 예정)
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
