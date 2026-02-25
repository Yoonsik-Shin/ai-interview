package me.unbrdn.core.interview.application.interactor;

import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.application.dto.result.GetInterviewResult;
import me.unbrdn.core.interview.application.port.in.GetInterviewUseCase;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetInterviewInteractor implements GetInterviewUseCase {

    private final InterviewPort interviewPort;

    @Override
    @Transactional(readOnly = true)
    public GetInterviewResult execute(GetInterviewQuery query) {
        InterviewSession session =
                interviewPort
                        .loadById(query.interviewId())
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Interview not found: " + query.interviewId()));

        return GetInterviewResult.builder()
                .interviewId(session.getId())
                .status(session.getStatus())
                .currentStage(session.getCurrentStage())
                .type(session.getType())
                .domain(session.getDomain())
                .targetDurationMinutes(session.getTargetDurationMinutes())
                .selfIntroduction(session.getSelfIntroduction())
                .interviewerRoles(session.getRoles())
                .personality(session.getPersonality())
                .interviewerCount(session.getInterviewerCount())
                .startedAt(session.getStartedAt() != null ? session.getStartedAt() : null)
                .resumedAt(session.getResumedAt())
                .build();
    }
}
