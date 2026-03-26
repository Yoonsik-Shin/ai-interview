import { IsNotEmpty, IsString, Matches, MinLength, MaxLength } from "class-validator";

export class CompleteOAuthProfileRequestDto {
    @IsString()
    @IsNotEmpty()
    pendingToken: string;

    @IsString()
    @IsNotEmpty()
    role: string;

    @IsString()
    @MinLength(2)
    @MaxLength(20)
    @Matches(/^[가-힣a-zA-Z0-9]+$/, { message: "닉네임은 한글, 영문, 숫자만 사용 가능합니다." })
    nickname: string;

    @IsString()
    @Matches(/^01[016789][0-9]{3,4}[0-9]{4}$/, { message: "올바른 휴대폰 번호 형식이 아닙니다." })
    phoneNumber: string;

    @IsString()
    @IsNotEmpty()
    password: string;
}
