package me.unbrdn.core.interview.application.interactor;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.event.LlmResponseCompletedEvent;
import me.unbrdn.core.interview.application.port.in.TransitionInterviewStageUseCase;
import me.unbrdn.core.interview.domain.enums.InterviewStage;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class InterviewSequenceManager {

    private final TransitionInterviewStageUseCase transitionInterviewStageUseCase;

    @EventListener
    public void handleLlmResponseCompleted(LlmResponseCompletedEvent event) {
        log.info(
                "Received LlmResponseCompletedEvent: interviewId={}, stage={}, isEndSignal={}",
                event.getInterviewId(),
                event.getStage(),
                event.isEndSignal());

        try {
            UUID interviewId = UUID.fromString(event.getInterviewId());

            if (event.isEndSignal()) {
                if (event.getStage() == InterviewStage.LAST_QUESTION_PROMPT) {
                    log.info(
                            "End Signal received in LAST_QUESTION_PROMPT. Transitioning to LAST_ANSWER.");
                    transitionInterviewStageUseCase.execute(
                            new TransitionInterviewStageUseCase.TransitionStageCommand(
                                    interviewId, InterviewStage.LAST_ANSWER.name()));
                } else if (event.getStage() != InterviewStage.LAST_ANSWER
                        && event.getStage() != InterviewStage.CLOSING_GREETING) {
                    log.info(
                            "Interview End Signal received. Transitioning to LAST_QUESTION_PROMPT.");
                    transitionInterviewStageUseCase.execute(
                            new TransitionInterviewStageUseCase.TransitionStageCommand(
                                    interviewId, InterviewStage.LAST_QUESTION_PROMPT.name()));
                }
                return;
            }

            switch (event.getStage()) {
                case CANDIDATE_GREETING -> {
                    // This is a backup for redundant triggers.
                    log.info("Candidate Greeting finished. Transitioning to INTERVIEWER_INTRO.");
                    transitionInterviewStageUseCase.execute(
                            new TransitionInterviewStageUseCase.TransitionStageCommand(
                                    interviewId, InterviewStage.INTERVIEWER_INTRO.name()));
                }
                default -> {
                    // Other stages (GREETING, SELF_INTRO_PROMPT, CLOSING_GREETING)
                    // should wait for client audio completion and call transition via gRPC.
                }
            }
        } catch (Exception e) {
            log.error("Failed to handle stage transition logic in SequenceManager", e);
        }
    }
}
