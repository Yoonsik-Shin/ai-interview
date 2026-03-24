package me.unbrdn.core.interview.application.port.out;

import java.util.List;
import me.unbrdn.core.interview.adapter.out.persistence.entity.InterviewMessageJpaEntity;
import me.unbrdn.core.interview.application.dto.command.CallLlmCommand;
import me.unbrdn.core.interview.application.dto.result.GenerateReportResult;

/** LLM 서비스 호출을 위한 Port Hexagonal Architecture - Output Port */
public interface CallLlmPort {
    void generateResponse(CallLlmCommand command);

    void generateResponseSync(CallLlmCommand command);

    GenerateReportResult generateReport(String interviewId, List<InterviewMessageJpaEntity> messages);
}
