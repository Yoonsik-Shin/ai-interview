package me.unbrdn.core.interview.application.interactor;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.dto.command.SaveInterviewMessageCommand;
import me.unbrdn.core.interview.application.port.in.SaveInterviewMessageUseCase;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.application.port.out.ManageSessionStatePort;
import me.unbrdn.core.interview.application.port.out.SaveInterviewMessagePort;
import me.unbrdn.core.interview.domain.entity.InterviewMessage;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import me.unbrdn.core.interview.domain.enums.MessageRole;
import me.unbrdn.core.interview.domain.model.InterviewSessionState;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class SaveInterviewMessageInteractor implements SaveInterviewMessageUseCase {

    private final SaveInterviewMessagePort saveInterviewMessagePort;
    private final InterviewPort interviewPort;
    private final ManageSessionStatePort sessionStatePort;

    @Override
    public void execute(SaveInterviewMessageCommand command) {
        try {
            InterviewSession session =
                    interviewPort
                            .loadById(UUID.fromString(command.getInterviewId()))
                            .orElseThrow(() -> new IllegalArgumentException("Session not found"));

            InterviewSessionState state =
                    sessionStatePort
                            .getState(command.getInterviewId())
                            .orElse(InterviewSessionState.createDefault());

            InterviewMessage message =
                    InterviewMessage.create(
                            session,
                            state.getTurnCount() != null ? state.getTurnCount() : 0,
                            command.getSentenceIndex(),
                            state.getCurrentStage(),
                            MessageRole.AI,
                            command.getSentence(),
                            null);

            saveInterviewMessagePort.save(message);
            log.info(
                    "Saved InterviewMessage to DB: interviewId={}, sequenceNumber={}",
                    command.getInterviewId(),
                    command.getSentenceIndex());
        } catch (Exception e) {
            log.error("Failed to save interview message to DB", e);
        }
    }
}
