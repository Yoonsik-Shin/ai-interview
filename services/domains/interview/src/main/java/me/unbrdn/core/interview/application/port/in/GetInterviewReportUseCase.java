package me.unbrdn.core.interview.application.port.in;

import java.util.UUID;
import me.unbrdn.core.interview.domain.enums.PassFailStatus;
import me.unbrdn.core.interview.domain.enums.ReportGenerationStatus;

public interface GetInterviewReportUseCase {

    record GetReportQuery(UUID interviewId, UUID reportId) {}

    record GetReportResult(
            UUID reportId,
            ReportGenerationStatus generationStatus,
            int totalScore,
            PassFailStatus passFailStatus,
            String summaryText,
            String resumeFeedback) {}

    GetReportResult execute(GetReportQuery query);
}
