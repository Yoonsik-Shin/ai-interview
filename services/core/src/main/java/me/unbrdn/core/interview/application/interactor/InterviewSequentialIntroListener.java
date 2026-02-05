package me.unbrdn.core.interview.application.interactor;

import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.dto.command.CallLlmCommand;
import me.unbrdn.core.interview.application.event.InterviewerIntroFinishedEvent;
import me.unbrdn.core.interview.application.port.out.CallLlmPort;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.application.port.out.ManageConversationHistoryPort;
import me.unbrdn.core.interview.application.port.out.ManageSessionStatePort;
// import me.unbrdn.core.interview.domain.enums.InterviewPersona; // Removed
import me.unbrdn.core.interview.domain.enums.InterviewStage;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class InterviewSequentialIntroListener {

    private final InterviewPort interviewPort;
    private final CallLlmPort callLlmPort;
    private final ManageSessionStatePort sessionStatePort;
    private final ManageConversationHistoryPort conversationHistoryPort;

    @EventListener
    public void handleInterviewerIntroFinished(InterviewerIntroFinishedEvent event) {
        log.info("Received InterviewerIntroFinishedEvent for session: {}", event.getInterviewSessionId());

        try {
            UUID sessionId = UUID.fromString(event.getInterviewSessionId());
            var sessionOpt = interviewPort.loadById(sessionId);

            sessionOpt.ifPresent(session -> {
                if (session.getStage() == InterviewStage.INTERVIEWER_INTRO) {
                    sessionStatePort.getState(event.getInterviewSessionId()).ifPresent(state -> {
                        List<String> personas = state.getParticipatingPersonas();
                        Integer nextIdx = state.getNextPersonaIndex();

                        if (personas != null && nextIdx != null && nextIdx < personas.size()) {
                            String nextRoleName = personas.get(nextIdx); // Actually role names now
                            me.unbrdn.core.interview.domain.enums.InterviewRole nextRole = me.unbrdn.core.interview.domain.enums.InterviewRole
                                    .valueOf(nextRoleName);

                            log.info("Triggering next sequential interviewer intro: {}", nextRoleName);

                            long totalDurationSeconds = session.getTargetDurationMinutes() * 60L;
                            long remainingTimeSeconds = totalDurationSeconds;

                            CallLlmCommand llmCommand = CallLlmCommand.builder().interviewId(event.getInterviewId())
                                    .interviewSessionId(session.getId().toString()).userId(event.getUserId())
                                    .userText("면접관님, 지원자에게 간단히 본인 소개를 해주세요.").availableRoles(List.of(nextRole))
                                    .personality(session.getPersonality()) // Same personality for all
                                    .history(conversationHistoryPort.loadHistory(event.getInterviewId()))
                                    .mode(event.getMode()).stage(session.getStage())
                                    .interviewerCount(session.getInterviewerCount()).domain(session.getDomain())
                                    .totalDurationSeconds(totalDurationSeconds)
                                    .remainingTimeSeconds(remainingTimeSeconds)
                                    .currentDifficultyLevel(
                                            state.getCurrentDifficulty() != null ? state.getCurrentDifficulty()
                                                    : session.getCurrentDifficulty())
                                    .lastInterviewerId(
                                            state.getLastInterviewerId() != null ? state.getLastInterviewerId()
                                                    : session.getLastInterviewerId())
                                    .build();

                            callLlmPort.generateResponse(llmCommand);

                            // Update next index
                            state.setNextPersonaIndex(nextIdx + 1);
                            sessionStatePort.saveState(event.getInterviewSessionId(), state);
                        } else {
                            log.info("All interviewers introduced. Transitioning to SELF_INTRO_PROMPT.");
                            session.transitionToSelfIntroPrompt();
                            interviewPort.save(session);
                        }
                    });
                }
            });
        } catch (Exception e) {
            log.error("Failed to handle sequential interviewer intro via event", e);
        }
    }
}
