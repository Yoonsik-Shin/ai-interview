package me.unbrdn.core.auth.application.port.in;

import me.unbrdn.core.auth.application.interactor.dto.command.LoginWithOAuthCommand;
import me.unbrdn.core.auth.application.interactor.dto.result.LoginWithOAuthResult;

public interface LoginWithOAuthUseCase {
    LoginWithOAuthResult execute(LoginWithOAuthCommand command);
}
