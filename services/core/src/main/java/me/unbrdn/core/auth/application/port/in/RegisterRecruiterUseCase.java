package me.unbrdn.core.auth.application.port.in;

import java.util.UUID;
import me.unbrdn.core.auth.application.interactor.dto.command.RegisterRecruiterCommand;

public interface RegisterRecruiterUseCase {
    UUID execute(RegisterRecruiterCommand command);
}
