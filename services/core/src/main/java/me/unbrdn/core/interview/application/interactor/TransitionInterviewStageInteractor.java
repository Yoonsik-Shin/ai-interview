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

        InterviewSessionState state =
                sessionStatePort
                        .getState(session.getId().toString())
                        .orElseGet(() -> InterviewSessionState.fromEntity(session));
        InterviewStage previousStage = state.getCurrentStage();

        state.setCurrentStage(stageEnum);
        sessionStatePort.saveState(session.getId().toString(), state);

        // Domain logic - Trigger specific events based on stage
        switch (stageEnum) {
            case INTERVIEWER_INTRO -> {
                // INTERVIEWER_INTRO 단계 진입 시 면접관 소개 자동 발화 트리거
                triggerInterviewerIntro(session, state);
            }
            case IN_PROGRESS -> {
                // Trigger the first question when entering IN_PROGRESS stage
                triggerFirstQuestion(session, state);
            }
            case CLOSING_GREETING -> {
                // CLOSING_GREETING 단계 진입 시 마무리 인사 자동 발화 트리거
                triggerClosingGreeting(session, state);
            }
            case COMPLETED -> {
                session.complete();
                flushSessionStateToRdb(session);
            }
            case WAITING -> throw new IllegalArgumentException(
                    "Cannot transition back to WAITING stage");
            default -> {} // other stages don't need explicit triggers
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
                        .previousStage(previousStage != null ? previousStage.name() : "WAITING")
                        .build());
    }

    private void triggerInterviewerIntro(InterviewSession session, InterviewSessionState state) {
        String interviewId = session.getId().toString();
        String userId = session.getCandidate().getId().toString();
        List<ConversationHistory> history = manageConversationHistoryPort.loadHistory(interviewId);

        // Calc time
        long totalDurationSeconds = session.getTargetDurationMinutes() * 60L;
        long remainingTimeSeconds = totalDurationSeconds;

        // Determine participating roles
        List<String> participatingPersonas = state.getParticipatingPersonas();
        if (participatingPersonas == null || participatingPersonas.isEmpty()) {
            log.warn("No interview roles configured for session: {}", interviewId);
            return;
        }

        // 중복 역할이 있다면 한 번만 소개되도록 정규화
        List<String> distinctPersonas = participatingPersonas.stream().distinct().toList();
        if (distinctPersonas.size() != participatingPersonas.size()) {
            log.info(
                    "Deduplicated interview personas for session {}: original={}, distinct={}",
                    interviewId,
                    participatingPersonas,
                    distinctPersonas);
        }

        state.setRemainingTimeSeconds(remainingTimeSeconds);
        state.setParticipatingPersonas(distinctPersonas);
        // 첫 번째 소개는 여기서 처리하므로, 다음 소개부터 listener에서 1,2,... 순서로 사용
        state.setNextPersonaIndex(1);
        sessionStatePort.saveState(session.getId().toString(), state);

        // Trigger ONLY the FIRST role explicitly
        String firstRoleName = distinctPersonas.get(0);
        InterviewRole firstRole = InterviewRole.valueOf(firstRoleName);

        CallLlmCommand llmCommand =
                CallLlmCommand.builder()
                        .interviewId(session.getId().toString())
                        .userId(userId)
                        .userText(
                                "면접관님, 지원자에게 간단히 본인 소개를 해주세요. 단, 이름이나 '[면접관 이름]' 같은 임의의 텍스트를 사용하지 말고 (예: 기술 면접관입니다) 본인의 직무 역할만으로 자연스럽게 소개해주세요.")
                        .inputRole("system")
                        .availableRoles(List.of(firstRole))
                        .personality(session.getPersonality())
                        .personaId(
                                session.getPersonality() != null
                                        ? session.getPersonality().name()
                                        : "DEFAULT")
                        .mode(session.getType().name())
                        .stage(state.getCurrentStage())
                        .interviewerCount(distinctPersonas.size())
                        .domain(session.getDomain())
                        .totalDurationSeconds(totalDurationSeconds)
                        .remainingTimeSeconds(remainingTimeSeconds)
                        .currentDifficultyLevel(state.getCurrentDifficulty())
                        .lastInterviewerId(state.getLastInterviewerId())
                        .build();

        callLlmPort.generateResponse(llmCommand);
    }

    private void triggerFirstQuestion(InterviewSession session, InterviewSessionState state) {
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
        List<String> personas = state.getParticipatingPersonas();
        List<InterviewRole> availableRoles;
        if (personas != null && personas.contains("LEADER")) {
            availableRoles = List.of(InterviewRole.LEADER);
        } else if (personas != null && !personas.isEmpty()) {
            availableRoles = personas.stream().map(InterviewRole::valueOf).toList();
        } else {
            availableRoles = List.of(InterviewRole.TECH);
        }

        CallLlmCommand llmCommand =
                CallLlmCommand.builder()
                        .interviewId(session.getId().toString())
                        .userId(userId)
                        .userText("지원자가 자기소개를 마쳤습니다. 이제 이력서를 바탕으로 첫 번째 면접 질문을 시작해주세요.")
                        .inputRole("system")
                        .availableRoles(availableRoles)
                        .personality(session.getPersonality())
                        .personaId(
                                session.getPersonality() != null
                                        ? session.getPersonality().name()
                                        : "DEFAULT")
                        .mode(session.getType().name())
                        .stage(state.getCurrentStage())
                        .interviewerCount(personas != null ? personas.size() : 1)
                        .domain(session.getDomain())
                        .totalDurationSeconds(totalDurationSeconds)
                        .remainingTimeSeconds(remainingTimeSeconds)
                        .currentDifficultyLevel(state.getCurrentDifficulty())
                        .lastInterviewerId(state.getLastInterviewerId())
                        .build();

        callLlmPort.generateResponse(llmCommand);
    }

    private void triggerClosingGreeting(InterviewSession session, InterviewSessionState state) {
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
        List<String> personas = state.getParticipatingPersonas();
        List<InterviewRole> availableRoles;
        if (personas != null && personas.contains("LEADER")) {
            availableRoles = List.of(InterviewRole.LEADER);
        } else if (personas != null && !personas.isEmpty()) {
            availableRoles = personas.stream().map(InterviewRole::valueOf).toList();
        } else {
            availableRoles = List.of(InterviewRole.TECH); // fallback
        }

        CallLlmCommand llmCommand =
                CallLlmCommand.builder()
                        .interviewId(session.getId().toString())
                        .userId(userId)
                        .userText("면접이 모두 끝났습니다. 지원자에게 따뜻한 마무리 인사와 함께 면접 종료를 안내해주세요.")
                        .inputRole("system")
                        .availableRoles(availableRoles)
                        .personality(session.getPersonality())
                        .personaId(
                                session.getPersonality() != null
                                        ? session.getPersonality().name()
                                        : "DEFAULT")
                        .mode(session.getType().name())
                        .stage(state.getCurrentStage())
                        .interviewerCount(personas != null ? personas.size() : 1)
                        .domain(session.getDomain())
                        .totalDurationSeconds(totalDurationSeconds)
                        .remainingTimeSeconds(remainingTimeSeconds)
                        .currentDifficultyLevel(state.getCurrentDifficulty())
                        .lastInterviewerId(state.getLastInterviewerId())
                        .build();

        callLlmPort.generateResponse(llmCommand);
    }

    private void flushSessionStateToRdb(InterviewSession session) {
        sessionStatePort
                .getState(session.getId().toString())
                .ifPresent(
                        state -> {
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
