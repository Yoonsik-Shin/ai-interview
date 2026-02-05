package me.unbrdn.core.interview.application.port.out;

import java.util.Optional;
import me.unbrdn.core.interview.domain.model.InterviewSessionState;

public interface ManageSessionStatePort {
    void saveState(String sessionId, InterviewSessionState state);

    Optional<InterviewSessionState> getState(String sessionId);

    void deleteState(String sessionId);
}
