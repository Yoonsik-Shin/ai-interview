package me.unbrdn.core.interview.application.dto.result;

import java.util.UUID;
import lombok.Builder;
import lombok.Getter;
import me.unbrdn.core.interview.domain.enums.InterviewSessionStatus;

@Getter
@Builder
public class CreateInterviewResult {
    private final UUID interviewId;
    private final InterviewSessionStatus status;
}
