import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength, ValidateIf } from "class-validator";

export enum RegisterRole {
    Candidate = "CANDIDATE",
    Recruiter = "RECRUITER",
}

export class RegisterRequestDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    password: string;

    @IsString()
    @IsEnum(RegisterRole)
    role: RegisterRole;

    @IsString()
    @IsNotEmpty()
    nickname: string;

    // TODO: 유효성 검사 추가 필요
    @IsString()
    @IsNotEmpty()
    phoneNumber: string;

    @ValidateIf(({ role }) => role === RegisterRole.Recruiter)
    @IsString()
    @IsNotEmpty()
    companyCode?: string;
}
