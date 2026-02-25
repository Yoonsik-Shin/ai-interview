package me.unbrdn.core.interview.application.interactor;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.port.in.PauseInterviewUseCase;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.application.port.out.ProduceInterviewEventPort;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class PauseInterviewInteractor implements PauseInterviewUseCase {

    private final InterviewPort interviewPort;
    private final ProduceInterviewEventPort produceInterviewEventPort;

    @Override
    @Transactional
    public PauseInterviewResult execute(PauseInterviewCommand command) {
        log.info("Pausing interview: {}", command.interviewId());

        // Load interview session
        InterviewSession session =
                interviewPort
                        .loadById(command.interviewId())
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "면접 세션을 찾을 수 없습니다: " + command.interviewId()));

        // Pause the interview
        session.pause();

        // Save the updated session
        interviewPort.save(session);

        // Publish event
        produceInterviewEventPort.publishInterviewPaused(session.getId().toString());

        log.info("Interview paused: interviewId={}", session.getId());

        return new PauseInterviewResult(
                session.getId().toString(),
                session.getStatus().name(),
                session.getPausedAt() != null ? session.getPausedAt().toString() : null);
    }
}
