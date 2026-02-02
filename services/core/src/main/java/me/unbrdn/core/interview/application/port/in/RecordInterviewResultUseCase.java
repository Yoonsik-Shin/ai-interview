package me.unbrdn.core.interview.application.port.in;

import me.unbrdn.core.interview.application.dto.command.RecordInterviewResultCommand;

public interface RecordInterviewResultUseCase {
    void execute(RecordInterviewResultCommand command);
}
