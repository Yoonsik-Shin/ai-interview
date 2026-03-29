package me.unbrdn.core.interview.application.interactor;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.dto.command.SaveInterviewMessageCommand;
import me.unbrdn.core.interview.application.port.in.SaveInterviewMessageUseCase;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.application.port.out.ManageSessionStatePort;
import me.unbrdn.core.interview.application.port.out.SaveInterviewMessagePort;
import me.unbrdn.core.interview.application.support.InterviewMessagePersistencePolicy;
import me.unbrdn.core.interview.domain.entity.InterviewMessage;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import me.unbrdn.core.interview.domain.enums.InterviewStage;
import me.unbrdn.core.interview.domain.enums.MessageRole;
import me.unbrdn.core.interview.domain.enums.MessageSource;
import me.unbrdn.core.interview.domain.model.InterviewSessionState;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class SaveInterviewMessageInteractor implements SaveInterviewMessageUseCase {

    private final SaveInterviewMessagePort saveInterviewMessagePort;
    private final InterviewPort interviewPort;
    private final ManageSessionStatePort sessionStatePort;
    private final InterviewMessagePersistencePolicy persistencePolicy;

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

            Integer turnCount =
                    command.getTurnCount() != null
                            ? command.getTurnCount()
                            : (state.getTurnCount() != null ? state.getTurnCount() : 0);

            InterviewStage stage = state.getCurrentStage();
            if (command.getStage() != null && !command.getStage().isBlank()) {
                try {
                    stage = InterviewStage.valueOf(command.getStage());
                } catch (IllegalArgumentException ignored) {
                    log.warn(
                            "Unknown stage in SaveInterviewMessageCommand. interviewId={}, stage={}",
                            command.getInterviewId(),
                            command.getStage());
                }
            }

            MessageRole role = command.getRole() != null ? command.getRole() : MessageRole.AI;
            if (!persistencePolicy.shouldPersist(stage, role)) {
                log.info(
                        "Skip interview message persistence before SELF_INTRO: interviewId={}, role={}, stage={}",
                        command.getInterviewId(),
                        role,
                        stage);
                return;
            }

            InterviewMessage message =
                    InterviewMessage.create(
                            session,
                            turnCount,
                            command.getSentenceIndex(),
                            stage,
                            role,
                            command.getSource() != null ? command.getSource() : MessageSource.SYSTEM,
                            command.getSentence(),
                            null,
                            command.getPersonaId() != null ? command.getPersonaId() : "DEFAULT",
                            command.getDifficultyLevel());

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
