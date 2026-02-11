export class UserResponseDto {
    id: string;
    email: string;
    nickname: string;
    role: string;
    phoneNumber?: string;
    companyCode?: string;

    constructor(
        id: string,
        email: string,
        nickname: string,
        role: string,
        phoneNumber?: string,
        companyCode?: string,
    ) {
        this.id = id;
        this.email = email;
        this.nickname = nickname;
        this.role = role;
        this.phoneNumber = phoneNumber;
        this.companyCode = companyCode;
    }
}
