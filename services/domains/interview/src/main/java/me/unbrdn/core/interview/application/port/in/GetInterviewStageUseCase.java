package me.unbrdn.core.interview.application.port.in;

import java.util.UUID;

/** 면접 세션의 현재 Stage 조회 UseCase */
public interface GetInterviewStageUseCase {

    InterviewStageResult execute(GetInterviewStageQuery query);

    /** Query DTO */
    record GetInterviewStageQuery(UUID interviewId) {}

    record InterviewStageResult(
            me.unbrdn.core.interview.domain.enums.InterviewStage stage,
            java.util.List<String> participatingPersonas,
            String domain,
            Integer selfIntroRetryCount) {}
}
