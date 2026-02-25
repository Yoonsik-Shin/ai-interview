package me.unbrdn.core.interview.application.interactor;

import java.time.Duration;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.dto.command.CallLlmCommand;
import me.unbrdn.core.interview.application.dto.command.PublishTranscriptCommand;
import me.unbrdn.core.interview.application.port.in.TransitionInterviewStageUseCase;
import me.unbrdn.core.interview.application.port.out.CallLlmPort;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.application.port.out.ManageConversationHistoryPort;
import me.unbrdn.core.interview.application.port.out.ManageSessionStatePort;
import me.unbrdn.core.interview.application.port.out.ProduceInterviewEventPort;
import me.unbrdn.core.interview.application.port.out.PublishTranscriptPort;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import me.unbrdn.core.interview.domain.enums.InterviewRole;
import me.unbrdn.core.interview.domain.enums.InterviewStage;
import me.unbrdn.core.interview.domain.model.ConversationHistory;
import me.unbrdn.core.interview.domain.model.InterviewSessionState;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;

/** 면접 세션의 Stage 전환 Interactor */
@Service
@RequiredArgsConstructor
@Slf4j
public class TransitionInterviewStageInteractor implements TransitionInterviewStageUseCase {

    private final InterviewPort interviewPort;
    private final CallLlmPort callLlmPort;
    private final ManageConversationHistoryPort manageConversationHistoryPort;
    private final ManageSessionStatePort sessionStatePort;
    private final ProduceInterviewEventPort produceInterviewEventPort;
    private final PublishTranscriptPort publishTranscriptPort;

    @Override
    public void execute(TransitionStageCommand command) {
        InterviewSession session =
                interviewPort
                        .loadById(command.interviewId())
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Interview not found: " + command.interviewId()));

        // Parse String to Enum
        InterviewStage stageEnum;
        try {
            stageEnum = InterviewStage.valueOf(command.newStage());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Unknown stage: " + command.newStage());
        }

        InterviewStage previousStage = session.getStage();

        // Domain logic - Entity의 transition 메서드 호출
        switch (stageEnum) {
            case GREETING -> session.transitionToGreeting();
            case CANDIDATE_GREETING -> session.transitionToCandidateGreeting();
            case INTERVIEWER_INTRO -> {
                session.transitionToInterviewerIntro();
                // INTERVIEWER_INTRO 단계 진입 시 면접관 소개 자동 발화 트리거
                triggerInterviewerIntro(session);
            }
            case SELF_INTRO_PROMPT -> session.transitionToSelfIntroPrompt();
            case SELF_INTRO -> session.transitionToSelfIntro();
            case IN_PROGRESS -> {
                session.transitionToInProgress();
                // Trigger the first question when entering IN_PROGRESS stage
                triggerFirstQuestion(session);
            }
            case LAST_QUESTION_PROMPT -> session.transitionToLastQuestionPrompt();
            case LAST_ANSWER -> session.transitionToLastAnswer();
            case CLOSING_GREETING -> {
                session.transitionToClosingGreeting();
                // CLOSING_GREETING 단계 진입 시 마무리 인사 자동 발화 트리거
                triggerClosingGreeting(session);
            }
            case COMPLETED -> {
                session.transitionToCompleted();
                flushSessionStateToRdb(session);
            }
            case WAITING -> throw new IllegalArgumentException(
                    "Cannot transition back to WAITING stage");
        }

        try {
            interviewPort.save(session);
        } catch (ObjectOptimisticLockingFailureException e) {
            log.warn(
                    "Stage transition skipped due to optimistic lock conflict (another transition already occurred): {}",
                    e.getMessage());
            return;
        }

        // Publish System Event to Kafka/MongoDB for Audit Trail
        produceInterviewEventPort.produceMessage(
                session.getId().toString(),
                "SYSTEM",
                "STAGE_TRANSITION",
                "Stage transitioned to " + command.newStage(),
                Collections.singletonMap("newStage", command.newStage()));

        // Publish Stage Change Event to Redis Pub/Sub so UI updates instantly
        publishTranscriptPort.publish(
                PublishTranscriptCommand.builder()
                        .interviewId(session.getId().toString())
                        .type("STAGE_CHANGE")
                        .currentStage(command.newStage())
                        .previousStage(previousStage.name())
                        .build());
    }

    private void triggerInterviewerIntro(InterviewSession session) {
        String interviewId = session.getId().toString();
        String userId = session.getCandidate().getId().toString();
        List<ConversationHistory> history = manageConversationHistoryPort.loadHistory(interviewId);

        // Calc time
        long totalDurationSeconds = session.getTargetDurationMinutes() * 60L;
        long remainingTimeSeconds = totalDurationSeconds;

        // Determine participating roles
        List<InterviewRole> roles = session.getRoles();
        if (roles == null || roles.isEmpty()) {
            log.warn("No interview roles configured for session: {}", interviewId);
            return;
        }

        // 중복 역할이 있다면 한 번만 소개되도록 정규화
        List<InterviewRole> distinctRoles = roles.stream().distinct().toList();
        if (distinctRoles.size() != roles.size()) {
            log.info(
                    "Deduplicated interview roles for session {}: original={}, distinct={}",
                    interviewId,
                    roles,
                    distinctRoles);
        }

        // Update session state with participating roles (names) for sequential control
        InterviewSessionState state =
                sessionStatePort
                        .getState(session.getId().toString())
                        .orElseGet(() -> InterviewSessionState.fromEntity(session));

        state.setRemainingTimeSeconds(remainingTimeSeconds);
        state.setParticipatingPersonas(distinctRoles.stream().map(Enum::name).toList());
        // 첫 번째 소개는 여기서 처리하므로, 다음 소개부터 listener에서 1,2,... 순서로 사용
        state.setNextPersonaIndex(1);
        sessionStatePort.saveState(session.getId().toString(), state);

        // Trigger ONLY the FIRST role explicitly
        InterviewRole firstRole = distinctRoles.get(0);

        CallLlmCommand llmCommand =
                CallLlmCommand.builder()
                        .interviewId(session.getId().toString())
                        .userId(userId)
                        .userText(
                                "면접관님, 지원자에게 간단히 본인 소개를 해주세요. 단, 이름이나 '[면접관 이름]' 같은 임의의 텍스트를 사용하지 말고 (예: 기술 면접관입니다) 본인의 직무 역할만으로 자연스럽게 소개해주세요.")
                        .inputRole("system")
                        .availableRoles(List.of(firstRole))
                        .personality(session.getPersonality())
                        .history(history)
                        .mode(session.getType().name())
                        .stage(session.getStage())
                        .interviewerCount(session.getInterviewerCount())
                        .domain(session.getDomain())
                        .totalDurationSeconds(totalDurationSeconds)
                        .remainingTimeSeconds(remainingTimeSeconds)
                        .currentDifficultyLevel(getCurrentDifficulty(session))
                        .lastInterviewerId(getLastInterviewerId(session))
                        .build();

        callLlmPort.generateResponse(llmCommand);
    }

    private void triggerFirstQuestion(InterviewSession session) {
        String interviewId = session.getId().toString();

        // Increment turn count to avoid duplicate key in InterviewQnA
        sessionStatePort.incrementTurnCount(interviewId);
        session.incrementTurnCount();
        interviewPort.save(session);

        String userId = session.getCandidate().getId().toString();
        List<ConversationHistory> history = manageConversationHistoryPort.loadHistory(interviewId);

        // Calc time
        long totalDurationSeconds = session.getTargetDurationMinutes() * 60L;
        long elapsed = 0;
        if (session.getStartedAt() != null) {
            elapsed = Duration.between(session.getStartedAt(), Instant.now()).getSeconds();
        }
        long remainingTimeSeconds = Math.max(0, totalDurationSeconds - elapsed);

        // QnA 첫 질문은 반드시 리드 면접관(또는 첫 번째 역할)이 진행하도록 roles를 제한
        List<InterviewRole> roles = session.getRoles();
        List<InterviewRole> availableRoles;
        if (roles != null && roles.contains(InterviewRole.LEADER)) {
            availableRoles = List.of(InterviewRole.LEADER);
        } else {
            // LEADER가 없으면 기존 roles 전체를 사용
            availableRoles = roles;
        }

        CallLlmCommand llmCommand =
                CallLlmCommand.builder()
                        .interviewId(session.getId().toString())
                        .userId(userId)
                        .userText("지원자가 자기소개를 마쳤습니다. 이제 이력서를 바탕으로 첫 번째 면접 질문을 시작해주세요.")
                        .inputRole("system")
                        .availableRoles(availableRoles)
                        .personality(session.getPersonality())
                        .history(history)
                        .mode(session.getType().name())
                        .stage(session.getStage())
                        .interviewerCount(session.getInterviewerCount())
                        .domain(session.getDomain())
                        .totalDurationSeconds(totalDurationSeconds)
                        .remainingTimeSeconds(remainingTimeSeconds)
                        .currentDifficultyLevel(getCurrentDifficulty(session))
                        .lastInterviewerId(getLastInterviewerId(session))
                        .build();

        callLlmPort.generateResponse(llmCommand);
    }

    private void triggerClosingGreeting(InterviewSession session) {
        String interviewId = session.getId().toString();

        // Increment turn count to avoid duplicate key in InterviewQnA
        sessionStatePort.incrementTurnCount(interviewId);
        session.incrementTurnCount();
        interviewPort.save(session);

        String userId = session.getCandidate().getId().toString();
        List<ConversationHistory> history = manageConversationHistoryPort.loadHistory(interviewId);

        // Calc time
        long totalDurationSeconds = session.getTargetDurationMinutes() * 60L;
        long elapsed = 0;
        if (session.getStartedAt() != null) {
            elapsed = Duration.between(session.getStartedAt(), Instant.now()).getSeconds();
        }
        long remainingTimeSeconds = Math.max(0, totalDurationSeconds - elapsed);

        // 마무리 인사는 리드 면접관(LEADER)이 진행하도록 roles를 제한
        List<InterviewRole> roles = session.getRoles();
        List<InterviewRole> availableRoles;
        if (roles != null && roles.contains(InterviewRole.LEADER)) {
            availableRoles = List.of(InterviewRole.LEADER);
        } else {
            availableRoles = roles;
        }

        CallLlmCommand llmCommand =
                CallLlmCommand.builder()
                        .interviewId(session.getId().toString())
                        .userId(userId)
                        .userText("면접이 모두 끝났습니다. 지원자에게 따뜻한 마무리 인사와 함께 면접 종료를 안내해주세요.")
                        .inputRole("system")
                        .availableRoles(availableRoles)
                        .personality(session.getPersonality())
                        .history(history)
                        .mode(session.getType().name())
                        .stage(session.getStage())
                        .interviewerCount(session.getInterviewerCount())
                        .domain(session.getDomain())
                        .totalDurationSeconds(totalDurationSeconds)
                        .remainingTimeSeconds(remainingTimeSeconds)
                        .currentDifficultyLevel(getCurrentDifficulty(session))
                        .lastInterviewerId(getLastInterviewerId(session))
                        .build();

        callLlmPort.generateResponse(llmCommand);
    }

    private int getCurrentDifficulty(InterviewSession session) {
        return sessionStatePort
                .getState(session.getId().toString())
                .map(state -> state.getCurrentDifficulty())
                .orElse(session.getCurrentDifficulty());
    }

    private String getLastInterviewerId(InterviewSession session) {
        return sessionStatePort
                .getState(session.getId().toString())
                .map(state -> state.getLastInterviewerId())
                .orElse(session.getLastInterviewerId());
    }

    private void flushSessionStateToRdb(InterviewSession session) {
        sessionStatePort
                .getState(session.getId().toString())
                .ifPresent(
                        state -> {
                            if (state.getCurrentDifficulty() != null) {
                                session.updateDifficulty(state.getCurrentDifficulty());
                            }
                            if (state.getLastInterviewerId() != null) {
                                session.updateLastInterviewer(state.getLastInterviewerId());
                            }
                            if (state.getTurnCount() != null) {
                                // DB turnCount는 도메인 규칙에 따라 sync
                                while (session.getTurnCount() < state.getTurnCount()) {
                                    session.incrementTurnCount();
                                }
                            }
                            // Add other flush logic if needed
                            sessionStatePort.deleteState(session.getId().toString());
                        });
    }
}
