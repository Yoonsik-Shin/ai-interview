package me.unbrdn.core.auth.application.port.in;

import me.unbrdn.core.auth.application.interactor.dto.command.RefreshTokenCommand;
import me.unbrdn.core.auth.application.interactor.dto.result.RefreshTokenResult;

public interface RefreshTokenUseCase {
    RefreshTokenResult execute(RefreshTokenCommand command);
}
