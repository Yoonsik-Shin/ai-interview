package me.unbrdn.core.user.application.port.in;

import me.unbrdn.core.user.application.interactor.dto.command.RegisterCandidateCommand;
import me.unbrdn.core.user.application.interactor.dto.result.RegisterCandidateResult;

public interface RegisterCandidateUseCase {
    RegisterCandidateResult execute(RegisterCandidateCommand command);
}
