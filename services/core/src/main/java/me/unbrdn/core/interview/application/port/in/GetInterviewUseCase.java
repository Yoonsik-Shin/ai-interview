package me.unbrdn.core.interview.application.port.in;

import java.util.UUID;
import me.unbrdn.core.interview.application.dto.result.GetInterviewResult;

public interface GetInterviewUseCase {

    GetInterviewResult execute(GetInterviewQuery query);

    record GetInterviewQuery(UUID interviewId) {}
}
