import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, Max } from "class-validator";

// .proto의 Enum 값과 문자열이 일치해야 합니다.
export enum InterviewType {
    REAL = "REAL",
    PRACTICE = "PRACTICE",
}

export enum InterviewPersona {
    PRESSURE = "PRESSURE",
    COMFORTABLE = "COMFORTABLE",
    RANDOM = "RANDOM",
}

export class CreateInterviewDto {
    // userId는 토큰에서 추출하므로 여기선 제외 (일단 하드코딩 예정)
    @IsInt()
    @IsOptional()
    resumeId?: number;

    @IsString()
    @IsNotEmpty()
    domain: string;

    @IsEnum(InterviewType)
    type: InterviewType;

    @IsEnum(InterviewPersona)
    persona: InterviewPersona;

    @IsInt()
    @Min(1)
    @Max(4)
    interviewerCount: number;

    @IsInt()
    @Min(10)
    @Max(120)
    targetDurationMinutes: number;

    @IsString()
    selfIntroduction: string;
}
