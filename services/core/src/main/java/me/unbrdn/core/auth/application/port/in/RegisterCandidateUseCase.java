package me.unbrdn.core.auth.application.port.in;

import java.util.UUID;
import me.unbrdn.core.auth.application.interactor.dto.command.RegisterCandidateCommand;

public interface RegisterCandidateUseCase {
    UUID execute(RegisterCandidateCommand command);
}
