package me.unbrdn.core.interview.application.interactor;

import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.port.in.CancelInterviewUseCase;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.application.port.out.ProduceInterviewEventPort;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Interactor for cancelling an interview */
@Slf4j
@Service
@RequiredArgsConstructor
public class CancelInterviewInteractor implements CancelInterviewUseCase {

    private final InterviewPort interviewPort;
    private final ProduceInterviewEventPort produceEventPort;

    @Override
    @Transactional
    public CancelInterviewResult execute(CancelInterviewCommand command) {
        log.info(
                "Cancelling interview: interviewId={}, reason={}",
                command.interviewId(),
                command.reason());

        // 1. Load interview session
        InterviewSession session =
                interviewPort
                        .loadById(command.interviewId())
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Interview not found: " + command.interviewId()));

        // 2. Cancel the interview
        session.cancel(); // Status: * → CANCELLED

        // 3. Save
        interviewPort.save(session);

        // 4. Publish event to Kafka → MongoDB
        Map<String, Object> payload = new HashMap<>();
        if (command.reason() != null && !command.reason().isEmpty()) {
            payload.put("reason", command.reason());
        }

        produceEventPort.produceMessage(
                session.getId().toString(),
                "SYSTEM",
                "INTERVIEW_CANCELLED",
                "Interview cancelled",
                payload);

        log.info(
                "Interview cancelled: interviewId={}, reason={}",
                session.getId(),
                command.reason());

        return new CancelInterviewResult(
                session.getId().toString(), session.getStatus().name(), session.getId().toString());
    }
}
