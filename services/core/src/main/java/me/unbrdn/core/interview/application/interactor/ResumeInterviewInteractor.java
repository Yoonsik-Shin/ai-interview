package me.unbrdn.core.interview.application.interactor;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.port.in.ResumeInterviewUseCase;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.application.port.out.ProduceInterviewEventPort;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ResumeInterviewInteractor implements ResumeInterviewUseCase {

    private final InterviewPort interviewPort;
    private final ProduceInterviewEventPort produceInterviewEventPort;

    @Override
    @Transactional
    public ResumeInterviewResult execute(ResumeInterviewCommand command) {
        log.info("Resuming interview: {}", command.interviewId());

        // Load interview session
        InterviewSession session =
                interviewPort
                        .loadById(command.interviewId())
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "면접 세션을 찾을 수 없습니다: " + command.interviewId()));

        // Resume the interview
        session.resume();

        // Save the updated session
        interviewPort.save(session);

        // Publish event
        produceInterviewEventPort.publishInterviewResumed(session.getId().toString());

        log.info("Interview resumed successfully: {}", session.getId().toString());

        return new ResumeInterviewResult(
                session.getId().toString(),
                session.getStatus().name(),
                session.getResumedAt() != null ? session.getResumedAt().toString() : null);
    }
}
