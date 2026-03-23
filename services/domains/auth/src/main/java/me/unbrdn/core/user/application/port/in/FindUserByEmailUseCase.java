package me.unbrdn.core.user.application.port.in;

import me.unbrdn.core.user.application.interactor.dto.command.FindUserByEmailCommand;
import me.unbrdn.core.user.application.interactor.dto.result.FindUserByEmailResult;

public interface FindUserByEmailUseCase {
    FindUserByEmailResult execute(FindUserByEmailCommand command);
}
