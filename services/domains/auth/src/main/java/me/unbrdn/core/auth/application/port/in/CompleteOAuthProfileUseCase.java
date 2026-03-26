package me.unbrdn.core.auth.application.port.in;

import me.unbrdn.core.auth.application.interactor.dto.command.CompleteOAuthProfileCommand;
import me.unbrdn.core.auth.application.interactor.dto.result.AuthenticateUserResult;

public interface CompleteOAuthProfileUseCase {
    AuthenticateUserResult execute(CompleteOAuthProfileCommand command);
}
