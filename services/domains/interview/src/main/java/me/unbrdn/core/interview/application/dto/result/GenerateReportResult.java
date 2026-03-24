package me.unbrdn.core.interview.application.dto.result;

import lombok.Builder;
import lombok.Getter;
import me.unbrdn.core.interview.domain.enums.PassFailStatus;

@Getter
@Builder
public class GenerateReportResult {
    private final int totalScore;
    private final PassFailStatus passFailStatus;
    private final String summaryText;
    private final String resumeFeedback;
}
