package me.unbrdn.core.interview.application.interactor;

import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.dto.command.CallLlmCommand;
import me.unbrdn.core.interview.application.port.in.TransitionInterviewStageUseCase;
import me.unbrdn.core.interview.application.port.out.CallLlmPort;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.application.port.out.ManageConversationHistoryPort;
import me.unbrdn.core.interview.application.port.out.ManageSessionStatePort;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import me.unbrdn.core.interview.domain.model.ConversationHistory;
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

    @Override
    public void execute(TransitionStageCommand command) {
        InterviewSession session =
                interviewPort
                        .loadById(command.interviewSessionId())
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Interview session not found: "
                                                        + command.interviewSessionId()));

        // Domain logic - Entity의 transition 메서드 호출
        switch (command.newStage()) {
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
                // IN_PROGRESS 진입 시 첫 번째 면접 질문 생성 트리거
                triggerFirstQuestion(session);
            }
            case LAST_QUESTION_PROMPT -> session.transitionToLastQuestionPrompt();
            case LAST_ANSWER -> session.transitionToLastAnswer();
            case COMPLETED -> {
                session.transitionToCompleted();
                flushSessionStateToRdb(session);
            }
            case WAITING -> throw new IllegalArgumentException(
                    "Cannot transition back to WAITING stage");
            default -> throw new IllegalArgumentException("Unknown stage: " + command.newStage());
        }

        interviewPort.save(session);
    }

    private void triggerInterviewerIntro(InterviewSession session) {
        String interviewId = session.getSessionUuid();
        String userId = session.getCandidate().getId().toString();
        List<ConversationHistory> history = manageConversationHistoryPort.loadHistory(interviewId);

        // Calc time
        long totalDurationSeconds = session.getTargetDurationMinutes() * 60L;
        long remainingTimeSeconds = totalDurationSeconds;

        // Determine participating roles
        List<me.unbrdn.core.interview.domain.enums.InterviewRole> roles = session.getRoles();
        if (roles == null || roles.isEmpty()) {
            log.warn("No interview roles configured for session: {}", interviewId);
            return;
        }

        // 중복 역할이 있다면 한 번만 소개되도록 정규화
        List<me.unbrdn.core.interview.domain.enums.InterviewRole> distinctRoles =
                roles.stream().distinct().toList();
        if (distinctRoles.size() != roles.size()) {
            log.info(
                    "Deduplicated interview roles for session {}: original={}, distinct={}",
                    interviewId,
                    roles,
                    distinctRoles);
        }

        // Update session state with participating roles (names) for sequential control
        me.unbrdn.core.interview.domain.model.InterviewSessionState state =
                sessionStatePort
                        .getState(session.getId().toString())
                        .orElse(
                                me.unbrdn.core.interview.domain.model.InterviewSessionState
                                        .createDefault());

        state.setParticipatingPersonas(distinctRoles.stream().map(Enum::name).toList());
        // 첫 번째 소개는 여기서 처리하므로, 다음 소개부터 listener에서 1,2,... 순서로 사용
        state.setNextPersonaIndex(1);
        sessionStatePort.saveState(session.getId().toString(), state);

        // Trigger ONLY the FIRST role explicitly
        me.unbrdn.core.interview.domain.enums.InterviewRole firstRole = distinctRoles.get(0);

        CallLlmCommand llmCommand =
                CallLlmCommand.builder()
                        .interviewId(interviewId)
                        .interviewSessionId(session.getId().toString())
                        .userId(userId)
                        .userText("면접관님, 지원자에게 간단히 본인 소개를 해주세요.")
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
        String interviewId = session.getSessionUuid();
        String userId = session.getCandidate().getId().toString();
        List<ConversationHistory> history = manageConversationHistoryPort.loadHistory(interviewId);

        // Calc time
        long totalDurationSeconds = session.getTargetDurationMinutes() * 60L;
        long elapsed = 0;
        if (session.getStartedAt() != null) {
            elapsed =
                    java.time.Duration.between(
                                    session.getStartedAt(), java.time.LocalDateTime.now())
                            .getSeconds();
        }
        long remainingTimeSeconds = Math.max(0, totalDurationSeconds - elapsed);

        // QnA 첫 질문은 반드시 리드 면접관(또는 첫 번째 역할)이 진행하도록 roles를 제한
        List<me.unbrdn.core.interview.domain.enums.InterviewRole> roles = session.getRoles();
        List<me.unbrdn.core.interview.domain.enums.InterviewRole> availableRoles;
        if (roles != null
                && roles.contains(me.unbrdn.core.interview.domain.enums.InterviewRole.LEADER)) {
            availableRoles =
                    java.util.List.of(me.unbrdn.core.interview.domain.enums.InterviewRole.LEADER);
        } else {
            // LEADER가 없으면 기존 roles 전체를 사용
            availableRoles = roles;
        }

        CallLlmCommand llmCommand =
                CallLlmCommand.builder()
                        .interviewId(interviewId)
                        .interviewSessionId(session.getId().toString())
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
                            // Add other flush logic if needed
                            sessionStatePort.deleteState(session.getId().toString());
                        });
    }
}
