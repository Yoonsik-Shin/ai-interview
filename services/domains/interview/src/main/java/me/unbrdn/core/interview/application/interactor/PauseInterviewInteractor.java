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
    public PauseInterviewResult execute(PauseInterviewCommand command) {
        log.info("Pausing interview: {}", command.interviewId());

        // Update session in a transaction
        InterviewSession session = updateSessionToPaused(command.interviewId());

        // Publish event outside transaction to avoid holding DB connection
        produceInterviewEventPort.publishInterviewPaused(session.getId().toString());

        log.info("Interview paused: interviewId={}", session.getId());

        return new PauseInterviewResult(
                session.getId().toString(), session.getStatus().name(), null);
    }

    @Transactional
    public InterviewSession updateSessionToPaused(java.util.UUID interviewId) {
        InterviewSession session =
                interviewPort
                        .loadById(interviewId)
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "면접 세션을 찾을 수 없습니다: " + interviewId));

        session.pause();
        interviewPort.save(session);
        return session;
    }
}
