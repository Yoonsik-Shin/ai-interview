package me.unbrdn.core.user.application.port.in;

import me.unbrdn.core.user.application.interactor.dto.command.FindUserByIdCommand;
import me.unbrdn.core.user.application.interactor.dto.result.FindUserByIdResult;

public interface FindUserByIdUseCase {
    FindUserByIdResult execute(FindUserByIdCommand command);
}
