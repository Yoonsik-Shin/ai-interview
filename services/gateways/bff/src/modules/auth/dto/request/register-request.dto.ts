import { IsEmail, IsEnum, IsNotEmpty, IsString, Matches, MaxLength, MinLength, ValidateIf } from "class-validator";
import { RegisterRole } from "../../enum/auth.enum";

export class RegisterRequestDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(8, { message: "비밀번호는 최소 8자 이상이어야 합니다" })
    @MaxLength(72, { message: "비밀번호는 최대 72자 이하이어야 합니다" })
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+\[\]{};:'",.<>/?\\|`~]).+$/, {
        message: "비밀번호는 대문자, 소문자, 숫자, 특수문자를 각 1개 이상 포함해야 합니다",
    })
    password: string;

    @IsString()
    @IsEnum(RegisterRole)
    role: RegisterRole;

    @IsString()
    @IsNotEmpty()
    @MinLength(2, { message: "닉네임은 최소 2자 이상이어야 합니다" })
    @MaxLength(20, { message: "닉네임은 최대 20자 이하이어야 합니다" })
    @Matches(/^[가-힣a-zA-Z0-9]+$/, {
        message: "닉네임은 한글, 영문, 숫자만 사용 가능합니다",
    })
    nickname: string;

    @IsString()
    @IsNotEmpty()
    @Matches(/^01[016789][0-9]{3,4}[0-9]{4}$/, {
        message: "올바른 전화번호 형식이 아닙니다 (예: 01012345678)",
    })
    phoneNumber: string;

    @ValidateIf(({ role }) => role === RegisterRole.Recruiter)
    @IsString()
    @IsNotEmpty()
    companyCode?: string;
}
