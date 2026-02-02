package me.unbrdn.core.interview.application.interactor;

import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.application.port.in.GetInterviewStageUseCase;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import org.springframework.stereotype.Service;

/** 면접 세션의 현재 Stage 조회 Interactor */
@Service
@RequiredArgsConstructor
public class GetInterviewStageInteractor implements GetInterviewStageUseCase {

    private final InterviewPort interviewPort;

    @Override
    public InterviewStageResult execute(GetInterviewStageQuery query) {
        InterviewSession session =
                interviewPort
                        .loadById(query.interviewSessionId())
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Interview session not found: "
                                                        + query.interviewSessionId()));

        return new InterviewStageResult(
                session.getStage(),
                session.getSelfIntroElapsedSeconds(),
                session.getPersona() != null ? session.getPersona().name() : null,
                session.getInterviewerCount(),
                session.getDomain());
    }
}
