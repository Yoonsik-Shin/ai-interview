package me.unbrdn.core.auth.application.port.in;

import me.unbrdn.core.auth.application.interactor.dto.command.RefreshTokenCommand;
import me.unbrdn.core.auth.application.interactor.dto.result.RefreshTokenResult;

public interface RefreshTokenUseCase {
    /**
     * 리프레시 토큰 갱신
     *
     * @param command 리프레시 토큰 명령 (리프레시 토큰)
     * @return 갱신된 토큰 정보
     */
    RefreshTokenResult execute(RefreshTokenCommand command);
}
