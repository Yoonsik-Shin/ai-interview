package me.unbrdn.core.interview.application.port.in;

import java.util.UUID;

/** 면접 세션의 Stage 전환 UseCase */
public interface TransitionInterviewStageUseCase {

    void execute(TransitionStageCommand command);

    /** Command DTO */
    record TransitionStageCommand(UUID interviewId, String newStage) {}
}
