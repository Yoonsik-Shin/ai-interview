package me.unbrdn.core.interview.application.port.out;

import java.util.Optional;
import me.unbrdn.core.interview.domain.model.InterviewSessionState;

public interface ManageSessionStatePort {
    void saveState(String interviewId, InterviewSessionState state);

    Optional<InterviewSessionState> getState(String interviewId);

    void deleteState(String interviewId);

    int incrementTurnCount(String interviewId);

    int incrementSelfIntroRetryCount(String interviewId);

    void updateStatus(
            String interviewId,
            me.unbrdn.core.interview.domain.model.InterviewSessionState.Status status,
            boolean canCandidateSpeak);
}
