package me.unbrdn.core.interview.application.port.in;

import java.util.UUID;
import me.unbrdn.core.interview.domain.enums.ReportGenerationStatus;

public interface CreateInterviewReportUseCase {

    record CreateReportCommand(UUID interviewId) {}

    record CreateReportResult(UUID reportId, ReportGenerationStatus generationStatus) {}

    CreateReportResult execute(CreateReportCommand command);
}
