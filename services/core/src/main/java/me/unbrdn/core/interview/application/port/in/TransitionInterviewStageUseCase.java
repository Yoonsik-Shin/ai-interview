package me.unbrdn.core.interview.application.port.in;

import java.util.UUID;
import me.unbrdn.core.interview.domain.enums.InterviewStage;

/** 면접 세션의 Stage 전환 UseCase */
public interface TransitionInterviewStageUseCase {

    void execute(TransitionStageCommand command);

    /** Command DTO */
    record TransitionStageCommand(UUID interviewSessionId, InterviewStage newStage) {}
}
