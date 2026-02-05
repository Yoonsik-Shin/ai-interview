package me.unbrdn.core.interview.application.port.in;

import java.util.UUID;

public interface IncrementSelfIntroRetryUseCase {
    int execute(UUID interviewSessionId);
}
