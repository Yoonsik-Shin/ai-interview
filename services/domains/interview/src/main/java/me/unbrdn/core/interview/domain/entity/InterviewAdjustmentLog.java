package me.unbrdn.core.interview.domain.entity;

import java.time.Instant;
import java.util.UUID;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class InterviewAdjustmentLog {
    private final UUID id;
    private final UUID interviewId;
    private final String
            adjustmentType; // TIME_REDUCTION, DIFFICULTY_CHANGE, STAGE_FORCE_TRANSITION
    private final String oldValue;
    private final String newValue;
    private final String reason;
    private final Instant createdAt;

    public static InterviewAdjustmentLog create(
            UUID interviewId, String type, String oldVal, String newVal, String reason) {
        return InterviewAdjustmentLog.builder()
                .id(UUID.randomUUID())
                .interviewId(interviewId)
                .adjustmentType(type)
                .oldValue(oldVal)
                .newValue(newVal)
                .reason(reason)
                .createdAt(Instant.now())
                .build();
    }
}
