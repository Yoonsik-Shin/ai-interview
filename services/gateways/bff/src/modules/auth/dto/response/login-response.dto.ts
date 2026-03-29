interface AuthResult {
    accessToken: string;
    user: { id: string; email: string; nickname: string; role: string };
}

class UserDto {
    id: string;
    email: string;
    nickname: string;
    role: string;
}

export class LoginResponseDto {
    accessToken: string;
    user: UserDto;

    constructor(result: AuthResult) {
        this.accessToken = result.accessToken;
        this.user = {
            id: result.user.id.toString(),
            email: result.user.email,
            nickname: result.user.nickname,
            role: result.user.role,
        };
    }
}
