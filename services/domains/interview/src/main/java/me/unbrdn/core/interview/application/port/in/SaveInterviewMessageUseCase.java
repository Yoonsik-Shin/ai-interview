package me.unbrdn.core.interview.application.port.in;

import me.unbrdn.core.interview.application.dto.command.SaveInterviewMessageCommand;

public interface SaveInterviewMessageUseCase {
    void execute(SaveInterviewMessageCommand command);
}
