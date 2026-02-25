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

        Integer retryCount =
                sessionStatePort
                        .getState(query.interviewId().toString())
                        .map(InterviewSessionState::getSelfIntroRetryCount)
                        .orElse(0);

        return new InterviewStageResult(
                session.getStage(),
                session.getSelfIntroElapsedSeconds(),
                session.getRoles(),
                session.getPersonality(),
                session.getInterviewerCount(),
                session.getDomain(),
                retryCount);
    }
}
