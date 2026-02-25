package me.unbrdn.core.interview.application.port.in;

import java.util.List;
import java.util.UUID;
import me.unbrdn.core.interview.domain.enums.InterviewPersonality;
import me.unbrdn.core.interview.domain.enums.InterviewRole;
import me.unbrdn.core.interview.domain.enums.InterviewStage;

/** 면접 세션의 현재 Stage 조회 UseCase */
public interface GetInterviewStageUseCase {

    InterviewStageResult execute(GetInterviewStageQuery query);

    /** Query DTO */
    record GetInterviewStageQuery(UUID interviewId) {}

    /** Result DTO */
    record InterviewStageResult(
            InterviewStage stage,
            Long selfIntroElapsedSeconds,
            List<InterviewRole> roles,
            InterviewPersonality personality,
            Integer interviewerCount,
            String domain,
            Integer selfIntroRetryCount) {}
}
