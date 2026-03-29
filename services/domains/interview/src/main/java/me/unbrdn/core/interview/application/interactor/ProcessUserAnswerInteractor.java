package me.unbrdn.core.interview.application.interactor;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.dto.command.CallLlmCommand;
import me.unbrdn.core.interview.application.dto.command.ProcessUserAnswerCommand;
import me.unbrdn.core.interview.application.dto.command.PublishTranscriptCommand;
import me.unbrdn.core.interview.application.port.in.ProcessUserAnswerUseCase;
import me.unbrdn.core.interview.application.port.in.TransitionInterviewStageUseCase;
import me.unbrdn.core.interview.application.port.out.CallLlmPort;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.application.port.out.ManageSessionStatePort;
import me.unbrdn.core.interview.application.port.out.PublishTranscriptPort;
import me.unbrdn.core.interview.application.port.out.SaveInterviewMessagePort;
import me.unbrdn.core.interview.application.support.InterviewMessagePersistencePolicy;
import me.unbrdn.core.interview.application.support.PersonaResolver;
import me.unbrdn.core.interview.application.support.TurnStatePublisher;
import me.unbrdn.core.interview.domain.entity.InterviewMessage;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import me.unbrdn.core.interview.domain.enums.InterviewStage;
import me.unbrdn.core.interview.domain.enums.MessageRole;
import me.unbrdn.core.interview.domain.enums.MessageSource;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProcessUserAnswerInteractor implements ProcessUserAnswerUseCase {

    private final CallLlmPort callLlmPort;
    private final InterviewPort interviewPort;
    private final PublishTranscriptPort publishTranscriptPort;
    private final ManageSessionStatePort sessionStatePort;
    private final SaveInterviewMessagePort saveInterviewMessagePort;
    private final TransitionInterviewStageUseCase transitionInterviewStageUseCase;
    private final TurnStatePublisher turnStatePublisher;
    private final PersonaResolver personaResolver;
    private final InterviewMessagePersistencePolicy persistencePolicy;

    @Override
    public void execute(ProcessUserAnswerCommand command) {
        log.info(
                "Processing user answer: interviewId={}, userId={}",
                command.getInterviewId(),
                command.getUserId());

        // 1. InterviewSession 조회하여 InterviewType(mode) 확인
        UUID interviewUuid = UUID.fromString(command.getInterviewId());
        InterviewSession interviewSession =
                interviewPort
                        .loadById(interviewUuid)
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Interview session not found: "
                                                        + command.getInterviewId()));

        me.unbrdn.core.interview.domain.model.InterviewSessionState state =
                sessionStatePort
                        .getState(command.getInterviewId())
                        .orElseThrow(
                                () ->
                                        new IllegalStateException(
                                                "Track 3 state missing for "
                                                        + command.getInterviewId()));

        InterviewStage originalStage = state.getCurrentStage();
        long now = System.currentTimeMillis();

        // [FUNDAMENTAL GUARD] 만약 메시지에 포함된 단계(stage)가 현재 세션의 단계와 다르면 지연된 메시지로 간주하고 무시합니다. (STT 지연 방어)
        if (command.getStage() != null && !command.getStage().equalsIgnoreCase(state.getCurrentStage().name())) {
            log.info(
                    "Ignoring stale STT transcript from previous stage. interviewId={}, commandStage={}, currentStage={}",
                    command.getInterviewId(),
                    command.getStage(),
                    state.getCurrentStage());
            return;
        }


        // [GUARD] 단계 전이 직후 3초 이내에 도착하는 잔여 오디오 데이터(Residue)는 무시하여 레이스 컨디션을 방지합니다.
        long lastStageTransitionAt =
                state.getLastStageTransitionAt() != null ? state.getLastStageTransitionAt() : 0;
        if (now - lastStageTransitionAt < 3000) {
            log.info(
                    "Ignoring speech detected shortly after stage transition (residue). interviewId={}, elapsed={}ms",
                    command.getInterviewId(),
                    now - lastStageTransitionAt);
            return;
        }

        // [FIX] 안내 음성(PROMPT) 중에는 사용자의 발화를 원천 차단하여 간섭을 방지합니다.
        if (originalStage == InterviewStage.SELF_INTRO_PROMPT) {
            log.info(
                    "Speech detected during SELF_INTRO_PROMPT. Ignoring to prevent LLM/Retry conflict. interviewId={}",
                    command.getInterviewId());
            return;
        }

        if (state.getStatus()
                != me.unbrdn.core.interview.domain.model.InterviewSessionState.Status.LISTENING) {
            log.warn("Drop message - Session not LISTENING. Current: {}", state.getStatus());
            return;
        }

        // 상태 변경 시작
        state.setStatus(
                me.unbrdn.core.interview.domain.model.InterviewSessionState.Status.THINKING);
        state.setCanCandidateSpeak(false);
        sessionStatePort.saveState(command.getInterviewId(), state);
        turnStatePublisher.publish(command.getInterviewId(), state);

        // Publish clear_turn to ensure Frontend UI is ready for new tokens (Track 1 UX Sync)
        PublishTranscriptCommand clearTurnCommand =
                PublishTranscriptCommand.builder()
                        .interviewId(command.getInterviewId())
                        .type("clear_turn")
                        .turnCount(state.getTurnCount() != null ? state.getTurnCount() : 0)
                        .build();
        publishTranscriptPort.publish(clearTurnCommand);

        String mode =
                interviewSession
                        .getType()
                        .name()
                        .toLowerCase(); // REAL -> "real", PRACTICE -> "practice"

        // [NEW] CANDIDATE_GREETING 처리: 사용자가 인사하면 텍스트 내용과 상관없이 바로 면접관 소개로 전이
        if (originalStage == InterviewStage.CANDIDATE_GREETING) {
            log.info(
                    "Transitioning from CANDIDATE_GREETING to INTERVIEWER_INTRO for interview: {}. User text: {}",
                    command.getInterviewId(),
                    command.getUserText());
            transitionInterviewStageUseCase.execute(
                    new TransitionInterviewStageUseCase.TransitionStageCommand(
                            interviewUuid, InterviewStage.INTERVIEWER_INTRO.name()));
            return;
        }

        // [NEW] LAST_ANSWER 처리: 사용자의 마지막 답변 이후 마무리 인사로 전이
        if (originalStage == InterviewStage.LAST_ANSWER) {
            persistUserMessage(interviewSession, state, originalStage, command.getUserText());
            log.info(
                    "Transitioning from LAST_ANSWER to CLOSING_GREETING for interview: {}",
                    command.getInterviewId());
            transitionInterviewStageUseCase.execute(
                    new TransitionInterviewStageUseCase.TransitionStageCommand(
                            interviewUuid, InterviewStage.CLOSING_GREETING.name()));
            return;
        }

        // [FIX] SELF_INTRO 처리: 리트라이 로직을 제거하고 항상 즉시 단계 전이 수행
        if (originalStage == InterviewStage.SELF_INTRO) {
            long selfIntroStart = state.getSelfIntroStart() != null ? state.getSelfIntroStart() : now;
            long elapsedSeconds = (now - selfIntroStart) / 1000;

            log.info("Self intro ended (elapsed={}s). Transitioning to IN_PROGRESS. interviewId={}", 
                    elapsedSeconds, command.getInterviewId());
            
            state.setSelfIntroText(command.getUserText());
            sessionStatePort.saveState(command.getInterviewId(), state);
            
            interviewSession.updateSelfIntroText(command.getUserText());
            interviewPort.save(interviewSession);

            try {
                // [FIX] Save User STT (Turn 0, Seq 0)
                saveInterviewMessagePort.save(InterviewMessage.create(
                        interviewSession, 0, 0, InterviewStage.SELF_INTRO,
                        MessageRole.USER, MessageSource.SYSTEM, command.getUserText(), null, "CANDIDATE", 3));
            } catch (Exception e) {
                log.error("Failed to save self-intro message", e);
            }

            transitionInterviewStageUseCase.execute(new TransitionInterviewStageUseCase.TransitionStageCommand(
                    interviewUuid, InterviewStage.IN_PROGRESS.name(), command.getUserText(), false));
            return;
        }

        // [FIX] 기획서(docs/llm-question-generation-context.md)와의 정합성 확보:
        // 면접관 교대 및 꼬리질문 여부는 LLM 서비스의 LangGraph(router 노드)가 결정합니다.
        // Core에서 강제로 교대할 경우 꼬리질문(Follow-up) 기획이 동작하지 않으므로,
        // 현재 면접관 ID를 그대로 전달하고 LLM의 응답 토큰에 포함된 persona_id로 상태를 업데이트합니다.
        String nextInterviewerId = state.getLastInterviewerId();
        List<String> personas = state.getParticipatingPersonas();

        if (nextInterviewerId == null
                || nextInterviewerId.isEmpty()
                || nextInterviewerId.equals("DEFAULT")) {
            nextInterviewerId = personaResolver.resolveLeadPersona(personas);
        }

        // 2-2. Persist user message to DB for report generation
        persistUserMessage(interviewSession, state, originalStage, command.getUserText());

        // 2-3. Update Session State (Increment Turn Count)
        updateTurnCount(interviewSession);

        // 3. LLM 호출 (스트리밍)
        long totalDurationSeconds = interviewSession.getScheduledDurationMinutes() * 60L;
        long elapsed = 0;
        if (interviewSession.getStartedAt() != null) {
            elapsed = Duration.between(interviewSession.getStartedAt(), Instant.now()).getSeconds();
        }
        long remainingTimeSeconds = Math.max(0, totalDurationSeconds - elapsed);

        CallLlmCommand llmCommand =
                CallLlmCommand.builder()
                        .interviewId(command.getInterviewId())
                        .resumeId(
                                state.getResumeId() != null
                                        ? state.getResumeId()
                                        : (interviewSession.getResumeId() != null
                                                ? interviewSession.getResumeId().toString()
                                                : null))
                        .userId(command.getUserId())
                        .userText(command.getUserText())
                        .personaId(nextInterviewerId)
                        .mode(mode)
                        .companyName(interviewSession.getCompanyName())
                        .scheduledDurationMinutes(interviewSession.getScheduledDurationMinutes())
                        .remainingTimeSeconds(remainingTimeSeconds)
                        .currentDifficultyLevel(
                                state.getCurrentDifficulty() != null
                                        ? state.getCurrentDifficulty()
                                        : 3)
                        .lastInterviewerId(nextInterviewerId)
                        .stage(state.getCurrentStage())
                        .interviewerCount(
                                state.getParticipatingPersonas() != null
                                        ? state.getParticipatingPersonas().size()
                                        : 1)
                        .domain(interviewSession.getDomain())
                        .participatingPersonas(state.getParticipatingPersonas())
                        .round(interviewSession.getRound())
                        .jobPostingUrl(interviewSession.getJobPostingUrl())
                        .selfIntroText(state.getSelfIntroText())
                        .build();

        callLlmPort.generateResponse(llmCommand);
    }

    private void persistUserMessage(
            InterviewSession session,
            me.unbrdn.core.interview.domain.model.InterviewSessionState state,
            InterviewStage stage,
            String content) {
        if (!persistencePolicy.shouldPersist(stage, MessageRole.USER)) {
            log.debug(
                    "Skip user message persistence before SELF_INTRO: interviewId={}, stage={}",
                    session.getId(),
                    stage);
            return;
        }
        try {
            InterviewMessage userMessage =
                    InterviewMessage.create(
                            session,
                            state.getTurnCount() != null ? state.getTurnCount() : 0,
                            0,
                            stage,
                            MessageRole.USER,
                            MessageSource.SYSTEM,
                            content,
                            null,
                            "CANDIDATE",
                            state.getCurrentDifficulty() != null
                                    ? state.getCurrentDifficulty()
                                    : 3);
            saveInterviewMessagePort.save(userMessage);
        } catch (Exception e) {
            log.error("Failed to persist user message to DB: interviewId={}", session.getId(), e);
        }
    }

    private void updateTurnCount(InterviewSession session) {
        String interviewId = session.getId().toString();
        try {
            // 1. Redis State Update (Atomic)
            int newTurnCount = sessionStatePort.incrementTurnCount(interviewId);

            // 2. DB Entity Update (Direct)
            session.incrementTurnCount();
            interviewPort.save(session);

            log.info(
                    "Incremented turn count to {} (Redis: {}) for session {}",
                    session.getTurnCount(),
                    newTurnCount,
                    interviewId);
        } catch (Exception e) {
            log.error("Failed to update turn count", e);
        }
    }
}
