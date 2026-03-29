package me.unbrdn.core.interview.application.port.in;

import java.util.UUID;

/** 면접 세션의 Stage 전환 UseCase */
public interface TransitionInterviewStageUseCase {

    void execute(TransitionStageCommand command);

    /** Command DTO */
    record TransitionStageCommand(UUID interviewId, String newStage, String selfIntroText, boolean isMaxRetryExceeded) {
        public TransitionStageCommand(UUID interviewId, String newStage) {
            this(interviewId, newStage, null, false);
        }
        
        public TransitionStageCommand(UUID interviewId, String newStage, String selfIntroText) {
            this(interviewId, newStage, selfIntroText, false);
        }
    }
}
