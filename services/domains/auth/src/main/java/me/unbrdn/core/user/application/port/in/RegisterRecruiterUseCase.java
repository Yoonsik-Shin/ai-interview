package me.unbrdn.core.user.application.port.in;

import me.unbrdn.core.user.application.interactor.dto.command.RegisterRecruiterCommand;
import me.unbrdn.core.user.application.interactor.dto.result.RegisterRecruiterResult;

public interface RegisterRecruiterUseCase {
    RegisterRecruiterResult execute(RegisterRecruiterCommand command);
}
