package me.unbrdn.core.interview.application.interactor;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.adapter.out.persistence.repository.InterviewMessageJpaRepository;
import me.unbrdn.core.interview.application.port.in.UpdateInterviewMessageMediaUrlUseCase;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class UpdateInterviewMessageMediaUrlInteractor
        implements UpdateInterviewMessageMediaUrlUseCase {

    private final InterviewMessageJpaRepository repository;

    @Override
    @Transactional
    public void execute(UpdateMediaUrlCommand command) {
        int maxAttempts = 3;
        int delayMs = 500;

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            var messageOpt =
                    repository.findByInterview_IdAndTurnCountAndSequenceNumberAndRole(
                            command.interviewId(),
                            command.turnCount(),
                            command.sequenceNumber(),
                            command.role());

            if (messageOpt.isPresent()) {
                var entity = messageOpt.get();
                entity.updateMediaUrl(command.mediaUrl());
                log.info(
                        "Updated mediaUrl for message: id={}, role={}, turn={}, seq={}, url={} (attempt={})",
                        entity.getId(),
                        command.role(),
                        command.turnCount(),
                        command.sequenceNumber(),
                        command.mediaUrl(),
                        attempt);
                return;
            }

            if (attempt < maxAttempts) {
                try {
                    log.debug(
                            "Message not found yet, retrying... (attempt={}/{}, id={})",
                            attempt,
                            maxAttempts,
                            command.interviewId());
                    Thread.sleep(delayMs);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }

        log.warn(
                "Message NOT found after {} attempts to update mediaUrl: interviewId={}, role={}, turn={}, seq={}",
                maxAttempts,
                command.interviewId(),
                command.role(),
                command.turnCount(),
                command.sequenceNumber());
    }
}
