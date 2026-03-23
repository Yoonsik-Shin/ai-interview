package me.unbrdn.core.interview.application.port.in;

import me.unbrdn.core.interview.application.dto.command.CreateInterviewCommand;
import me.unbrdn.core.interview.application.dto.result.CreateInterviewResult;

public interface CreateInterviewUseCase {
    CreateInterviewResult execute(CreateInterviewCommand command);
}
