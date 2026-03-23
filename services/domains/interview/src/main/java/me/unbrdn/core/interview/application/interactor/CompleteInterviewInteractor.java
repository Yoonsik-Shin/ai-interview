package me.unbrdn.core.interview.application.interactor;

import java.util.Collections;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.port.in.CompleteInterviewUseCase;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.application.port.out.ProduceInterviewEventPort;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Interactor for completing an interview */
@Slf4j
@Service
@RequiredArgsConstructor
public class CompleteInterviewInteractor implements CompleteInterviewUseCase {

    private final InterviewPort interviewPort;
    private final ProduceInterviewEventPort produceEventPort;

    @Override
    @Transactional
    public CompleteInterviewResult execute(CompleteInterviewCommand command) {
        log.info("Completing interview: interviewId={}", command.interviewId());

        // 1. Load interview session
        InterviewSession session =
                interviewPort
                        .loadById(command.interviewId())
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Interview not found: " + command.interviewId()));

        // 2. Complete the interview
        session.complete(); // Status: IN_PROGRESS → COMPLETED

        // 3. Stage transition removed (handled in Track 3 if needed)

        // 4. Save
        interviewPort.save(session);

        // 5. Publish event to Kafka → MongoDB
        produceEventPort.produceMessage(
                session.getId().toString(),
                "SYSTEM",
                "INTERVIEW_COMPLETED",
                "Interview completed successfully",
                Collections.emptyMap());

        log.info("Interview completed: interviewId={}", session.getId());

        return new CompleteInterviewResult(
                session.getId().toString(),
                session.getStatus().name(),
                session.getEndedAt() != null ? session.getEndedAt().toString() : "");
    }
}
