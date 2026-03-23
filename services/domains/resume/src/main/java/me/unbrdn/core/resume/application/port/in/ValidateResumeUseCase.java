package me.unbrdn.core.resume.application.port.in;

import me.unbrdn.core.resume.application.dto.ValidateResumeCommand;
import me.unbrdn.core.resume.application.dto.ValidateResumeResult;

public interface ValidateResumeUseCase {
    ValidateResumeResult execute(ValidateResumeCommand command);
}
