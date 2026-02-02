import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { GetUserUseCase } from "./usecases/get-user.usecase";
import { UserResponseDto } from "./dto/response/user-response.dto";

@Controller({ path: "users", version: "1" })
export class UsersController {
    constructor(private readonly getUserUseCase: GetUserUseCase) {}

    @Get("me")
    @UseGuards(JwtAuthGuard)
    async getMe(@CurrentUser() user: { userId: string }): Promise<UserResponseDto> {
        const result = await this.getUserUseCase.execute(user.userId);
        return new UserResponseDto(
            result.id,
            result.email,
            result.nickname,
            result.role,
            result.phoneNumber,
            result.companyCode,
        );
    }
}
