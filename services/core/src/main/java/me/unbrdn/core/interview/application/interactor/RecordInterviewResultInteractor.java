package me.unbrdn.core.interview.application.interactor;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.dto.command.RecordInterviewResultCommand;
import me.unbrdn.core.interview.application.port.in.RecordInterviewResultUseCase;
import me.unbrdn.core.interview.application.port.out.SaveInterviewHistoryPort;
import me.unbrdn.core.interview.domain.entity.InterviewHistory;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class RecordInterviewResultInteractor implements RecordInterviewResultUseCase {

    private final SaveInterviewHistoryPort saveInterviewHistoryPort;

    @Override
    public void execute(RecordInterviewResultCommand command) {
        if (command.getAiAnswer() == null || command.getAiAnswer().trim().isEmpty()) {
            log.warn("Skip interview result save: empty aiAnswer");
            return;
        }

        String userName =
                command.getUserId() == null || command.getUserId().isBlank()
                        ? "unknown"
                        : command.getUserId();

        String userAnswer = command.getUserAnswer() == null ? "" : command.getUserAnswer();

        InterviewHistory interviewHistory =
                InterviewHistory.create(userName, userAnswer, command.getAiAnswer());
        saveInterviewHistoryPort.save(interviewHistory);
    }
}
