package me.unbrdn.core.interview.application.interactor;

import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.application.dto.result.GetInterviewResult;
import me.unbrdn.core.interview.application.port.in.GetInterviewUseCase;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.application.port.out.ManageSessionStatePort;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetInterviewInteractor implements GetInterviewUseCase {

    private final InterviewPort interviewPort;
    private final ManageSessionStatePort sessionStatePort;

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

        var state = sessionStatePort.getState(query.interviewId().toString()).orElse(null);

        return GetInterviewResult.builder()
                .interviewId(session.getId())
                .status(session.getStatus())
                .currentStage(
                        state != null && state.getCurrentStage() != null
                                ? state.getCurrentStage()
                                : me.unbrdn.core.interview.domain.enums.InterviewStage.WAITING)
                .type(session.getType())
                .companyName(session.getCompanyName())
                .domain(session.getDomain())
                .scheduledDurationMinutes(session.getScheduledDurationMinutes())
                .participatingPersonas(session.getParticipatingPersonas())
                .startedAt(session.getStartedAt() != null ? session.getStartedAt() : null)
                .createdAt(session.getCreatedAt())
                .round(session.getRound())
                .jobPostingUrl(session.getJobPostingUrl())
                .selfIntroText(session.getSelfIntroText())
                .turnCount(
                        state != null && state.getTurnCount() != null
                                ? state.getTurnCount()
                                : session.getTurnCount())
                .build();
    }
}
