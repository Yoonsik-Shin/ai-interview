package me.unbrdn.core.interview.application.interactor;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.port.in.IncrementSelfIntroRetryUseCase;
import me.unbrdn.core.interview.application.port.out.ManageSessionStatePort;
import me.unbrdn.core.interview.domain.model.InterviewSessionState;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class IncrementSelfIntroRetryInteractor implements IncrementSelfIntroRetryUseCase {

    private final ManageSessionStatePort sessionStatePort;

    @Override
    public int execute(UUID interviewSessionId) {
        String sessionId = interviewSessionId.toString();
        InterviewSessionState state =
                sessionStatePort
                        .getState(sessionId)
                        .orElseGet(InterviewSessionState::createDefault);

        int currentCount =
                state.getSelfIntroRetryCount() != null ? state.getSelfIntroRetryCount() : 0;
        int newCount = currentCount + 1;

        state.setSelfIntroRetryCount(newCount);
        sessionStatePort.saveState(sessionId, state);

        log.info(
                "Incremented self-introduction retry count for session {}: {} -> {}",
                sessionId,
                currentCount,
                newCount);

        return newCount;
    }
}
