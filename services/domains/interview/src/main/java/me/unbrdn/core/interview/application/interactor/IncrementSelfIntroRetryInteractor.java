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
    public int execute(UUID interviewId) {
        String idStr = interviewId.toString();
        InterviewSessionState state =
                sessionStatePort.getState(idStr).orElseGet(InterviewSessionState::createDefault);

        int currentCount =
                state.getSelfIntroRetryCount() != null ? state.getSelfIntroRetryCount() : 0;
        int newCount = currentCount + 1;

        state.setSelfIntroRetryCount(newCount);
        sessionStatePort.saveState(idStr, state);

        log.info(
                "Incremented self-introduction retry count for interview {}: {} -> {}",
                idStr,
                currentCount,
                newCount);

        return newCount;
    }
}
