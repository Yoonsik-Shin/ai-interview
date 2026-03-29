package me.unbrdn.core.interview.application.port.in;

import java.util.UUID;
import me.unbrdn.core.interview.domain.enums.MessageRole;

public interface UpdateInterviewMessageMediaUrlUseCase {
    void execute(UpdateMediaUrlCommand command);

    record UpdateMediaUrlCommand(
            UUID interviewId,
            Integer turnCount,
            Integer sequenceNumber,
            MessageRole role,
            String mediaUrl) {}
}
