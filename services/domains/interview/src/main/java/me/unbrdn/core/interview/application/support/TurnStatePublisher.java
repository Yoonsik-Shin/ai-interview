package me.unbrdn.core.interview.application.support;

import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.application.dto.command.PublishTranscriptCommand;
import me.unbrdn.core.interview.application.port.out.PublishTranscriptPort;
import me.unbrdn.core.interview.domain.enums.InterviewStage;
import me.unbrdn.core.interview.domain.model.InterviewSessionState;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class TurnStatePublisher {

    private final PublishTranscriptPort publishTranscriptPort;

    public void publish(String interviewId, InterviewSessionState state) {
        publish(interviewId, state, null);
    }

    public void publish(
            String interviewId, InterviewSessionState state, String activePersonaOverride) {
        if (interviewId == null || state == null) {
            return;
        }

        InterviewStage stage =
                state.getCurrentStage() != null ? state.getCurrentStage() : InterviewStage.WAITING;
        InterviewSessionState.Status status =
                state.getStatus() != null ? state.getStatus() : InterviewSessionState.Status.READY;

        publishTranscriptPort.publish(
                PublishTranscriptCommand.builder()
                        .interviewId(interviewId)
                        .type("turn_state")
                        .currentStage(stage.name())
                        .status(status.name())
                        .turnCount(state.getTurnCount() != null ? state.getTurnCount() : 0)
                        .activePersonaId(
                                activePersonaOverride != null
                                        ? activePersonaOverride
                                        : state.getLastInterviewerId())
                        .canCandidateSpeak(
                                state.isCanCandidateSpeak() && canCandidateSpeak(stage, status))
                        .selfIntroRetryCount(state.getSelfIntroRetryCount())
                        .selfIntroStart(state.getSelfIntroStart())
                        .build());
    }

    private boolean canCandidateSpeak(InterviewStage stage, InterviewSessionState.Status status) {
        if (status != InterviewSessionState.Status.LISTENING) {
            return false;
        }

        return stage == InterviewStage.CANDIDATE_GREETING
                || stage == InterviewStage.SELF_INTRO
                || stage == InterviewStage.IN_PROGRESS
                || stage == InterviewStage.LAST_ANSWER;
    }
}
