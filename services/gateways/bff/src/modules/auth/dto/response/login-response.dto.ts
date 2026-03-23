import { LoginResult } from "../../usecases/login.usecase";

class UserDto {
    id: string;
    email: string;
    nickname: string;
    role: string;
}

export class LoginResponseDto {
    accessToken: string;
    user: UserDto;

    constructor(result: LoginResult) {
        this.accessToken = result.accessToken;
        this.user = {
            id: result.user.id.toString(),
            email: result.user.email,
            nickname: result.user.nickname,
            role: result.user.role,
        };
    }
}
