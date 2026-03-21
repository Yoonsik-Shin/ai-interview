package me.unbrdn.core.interview.application.interactor;

import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.application.port.in.GetInterviewStageUseCase;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.application.port.out.ManageSessionStatePort;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import me.unbrdn.core.interview.domain.model.InterviewSessionState;
import org.springframework.stereotype.Service;

/** 면접 세션의 현재 Stage 조회 Interactor */
@Service
@RequiredArgsConstructor
public class GetInterviewStageInteractor implements GetInterviewStageUseCase {

    private final InterviewPort interviewPort;
    private final ManageSessionStatePort sessionStatePort;

    @Override
    public InterviewStageResult execute(GetInterviewStageQuery query) {
        InterviewSession session =
                interviewPort
                        .loadById(query.interviewId())
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Interview not found: " + query.interviewId()));

        InterviewSessionState state =
                sessionStatePort.getState(query.interviewId().toString()).orElse(null);

        Integer retryCount = state != null ? state.getSelfIntroRetryCount() : 0;

        java.util.List<me.unbrdn.core.interview.domain.enums.InterviewRole> roles =
                state != null && state.getParticipatingPersonas() != null
                        ? state.getParticipatingPersonas().stream()
                                .map(me.unbrdn.core.interview.domain.enums.InterviewRole::valueOf)
                                .toList()
                        : java.util.Collections.emptyList();

        Integer interviewerCount =
                state != null && state.getParticipatingPersonas() != null
                        ? state.getParticipatingPersonas().size()
                        : 1;

        return new InterviewStageResult(
                roles, session.getPersonality(), interviewerCount, session.getDomain(), retryCount);
    }
}
