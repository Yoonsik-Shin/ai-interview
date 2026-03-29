package me.unbrdn.core.interview.application.port.in;

import java.util.UUID;
import lombok.Builder;
import lombok.Getter;

public interface RetrySelfIntroUseCase {
    @Getter
    @Builder
    class Result {
        private final int newRetryCount;
        private final boolean isMaxRetryExceeded;
    }

    Result execute(UUID interviewId, int durationSeconds);
}
