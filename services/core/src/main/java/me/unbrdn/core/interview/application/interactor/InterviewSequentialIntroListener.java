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
import me.unbrdn.core.interview.domain.enums.InterviewRole;
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
        log.info(
                "Received InterviewerIntroFinishedEvent for interview: {}", event.getInterviewId());

        try {
            UUID interviewId = UUID.fromString(event.getInterviewId());
            var sessionOpt = interviewPort.loadById(interviewId);

            sessionOpt.ifPresent(
                    session -> {
                        sessionStatePort
                                .getState(event.getInterviewId())
                                .ifPresent(
                                        state -> {
                                            if (state.getCurrentStage()
                                                    == InterviewStage.INTERVIEWER_INTRO) {
                                                List<String> personas =
                                                        state.getParticipatingPersonas();
                                                Integer nextIdx = state.getNextPersonaIndex();

                                                log.info(
                                                        "Sequential intro state: personas={}, nextIdx={}",
                                                        personas,
                                                        nextIdx);

                                                if (personas != null
                                                        && nextIdx != null
                                                        && nextIdx < personas.size()) {
                                                    String nextRoleName =
                                                            personas.get(
                                                                    nextIdx); // Actually role names
                                                    // now
                                                    InterviewRole nextRole =
                                                            InterviewRole.valueOf(nextRoleName);

                                                    log.info(
                                                            "Triggering next sequential interviewer intro: {}",
                                                            nextRoleName);

                                                    // Increment turn count to avoid duplicate key
                                                    // in InterviewQnA
                                                    sessionStatePort.incrementTurnCount(
                                                            event.getInterviewId());
                                                    session.incrementTurnCount();
                                                    interviewPort.save(session);

                                                    long totalDurationSeconds =
                                                            session.getTargetDurationMinutes()
                                                                    * 60L;
                                                    long remainingTimeSeconds =
                                                            totalDurationSeconds;

                                                    CallLlmCommand llmCommand =
                                                            CallLlmCommand.builder()
                                                                    .interviewId(
                                                                            session.getId()
                                                                                    .toString())
                                                                    .userId(event.getUserId())
                                                                    .userText(
                                                                            "앞선 면접관의 소개가 끝났습니다. 이제 면접관님의 차례입니다. 지원자에게 짧고 밝게 본인 소개를 해주세요. 단, 이름이나 '[면접관 이름]' 같은 임의의 텍스트를 사용하지 말고 (예: 기술 면접관입니다) 본인의 직무 역할만으로 자연스럽게 소개해주세요.")
                                                                    .inputRole("system")
                                                                    .availableRoles(
                                                                            List.of(nextRole))
                                                                    .personality(
                                                                            session
                                                                                    .getPersonality())
                                                                    .personaId(
                                                                            session.getPersonality()
                                                                                            != null
                                                                                    ? session.getPersonality()
                                                                                            .name()
                                                                                    : "DEFAULT")
                                                                    .mode(event.getMode())
                                                                    .stage(state.getCurrentStage())
                                                                    .interviewerCount(
                                                                            personas.size())
                                                                    .domain(session.getDomain())
                                                                    .totalDurationSeconds(
                                                                            totalDurationSeconds)
                                                                    .remainingTimeSeconds(
                                                                            remainingTimeSeconds)
                                                                    .currentDifficultyLevel(
                                                                            state
                                                                                    .getCurrentDifficulty())
                                                                    .lastInterviewerId(
                                                                            state
                                                                                    .getLastInterviewerId())
                                                                    .build();

                                                    callLlmPort.generateResponse(llmCommand);

                                                    // Update next index
                                                    state.setNextPersonaIndex(nextIdx + 1);
                                                    sessionStatePort.saveState(
                                                            event.getInterviewId(), state);
                                                } else {
                                                    log.info(
                                                            "All interviewers introduced. Transitioning to SELF_INTRO_PROMPT.");
                                                    state.setCurrentStage(
                                                            InterviewStage.SELF_INTRO_PROMPT);
                                                    sessionStatePort.saveState(
                                                            event.getInterviewId(), state);
                                                    // Trigger transit logic maybe? Handled by a
                                                    // separate command or left to the client
                                                }
                                            }
                                        });
                    });
        } catch (Exception e) {
            log.error("Failed to handle sequential interviewer intro via event", e);
        }
    }
}
