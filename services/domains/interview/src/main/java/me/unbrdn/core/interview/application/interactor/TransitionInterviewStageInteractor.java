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
import me.unbrdn.core.interview.application.port.out.ManageSessionStatePort;
import me.unbrdn.core.interview.application.port.out.ProduceInterviewEventPort;
import me.unbrdn.core.interview.application.port.out.PublishTranscriptPort;
import me.unbrdn.core.interview.application.support.PersonaResolver;
import me.unbrdn.core.interview.application.support.TurnStatePublisher;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import me.unbrdn.core.interview.domain.enums.InterviewStage;
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

    private final ManageSessionStatePort sessionStatePort;
    private final ProduceInterviewEventPort produceInterviewEventPort;
    private final PublishTranscriptPort publishTranscriptPort;
    private final GenerateReportInteractor generateReportInteractor;
    private final me.unbrdn.core.interview.application.port.out.SaveAdjustmentLogPort
            saveAdjustmentLogPort;
    private final TurnStatePublisher turnStatePublisher;
    private final PersonaResolver personaResolver;

    @Override
    @org.springframework.transaction.annotation.Transactional
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
        state.setLastStageTransitionAt(System.currentTimeMillis());

        // [IDEMPOTENCY GUARD] 이미 해당 단계에 있다면 중복 실행 방지
        // 단, 안내 음성 재생 단계(READY 신호)는 예외적으로 자기 전이를 허용함
        boolean isReadySignal =
                (previousStage == stageEnum)
                        && (stageEnum == InterviewStage.GREETING
                                || stageEnum == InterviewStage.INTERVIEWER_INTRO
                                || stageEnum == InterviewStage.SELF_INTRO_PROMPT);

        if (previousStage == stageEnum && !isReadySignal) {
            log.warn(
                    "Stage transition skipped. Current stage is already {}. interviewId: {}",
                    stageEnum,
                    session.getId());
            return;
        }

        // 재생 완료(READY) 신호 처리
        if (isReadySignal) {
            if (stageEnum == InterviewStage.GREETING) {
                handleGreetingReady(session, state);
            } else if (stageEnum == InterviewStage.INTERVIEWER_INTRO) {
                handleInterviewerIntroReady(session, state);
            } else if (stageEnum == InterviewStage.SELF_INTRO_PROMPT) {
                handleSelfIntroPromptReady(session, state);
            }
            return;
        }

        // [FIX] 전이 시점에 직접 전달된 자기소개 텍스트가 있으면 상태에 우선 반영하여 LLM 호출 시 지연 방지
        if (command.selfIntroText() != null && !command.selfIntroText().isEmpty()) {
            state.setSelfIntroText(command.selfIntroText());
        }

        // 인터뷰가 시작되면 Status를 READY -> IN_PROGRESS로 변경
        if (session.getStatus()
                        == me.unbrdn.core.interview.domain.enums.InterviewSessionStatus.READY
                && stageEnum != me.unbrdn.core.interview.domain.enums.InterviewStage.WAITING) {
            log.info("Starting interview session: {}", session.getId());
            session.start();
        }

        state.setCurrentStage(stageEnum);
        InterviewSessionState.Status initialStatus = determineInitialStatus(stageEnum);
        state.setStatus(initialStatus);
        
        // [FIX] Status에 맞춰 사용자의 발화 권한(canCandidateSpeak)을 명시적으로 관리 (상태 부합성 확보)
        state.setCanCandidateSpeak(initialStatus == InterviewSessionState.Status.LISTENING);

        // Domain logic - Trigger specific events based on stage
        switch (stageEnum) {
            case SELF_INTRO -> {
                // SELF_INTRO 진입 시 selfIntroStart 기록 (ProcessUserAnswerInteractor의 경과 시간 계산용,
                // Track 3)
                state.setSelfIntroStart(System.currentTimeMillis());
            }
            case SELF_INTRO_PROMPT -> {
                // SELF_INTRO_PROMPT 단계 진입 시 리드 면접관의 자기소개 요청 발화 트리거
                triggerSelfIntroPrompt(session, state);
            }
            case INTERVIEWER_INTRO -> {
                // INTERVIEWER_INTRO 단계 진입 시 면접관 소개 자동 발화 트리거
                triggerInterviewerIntro(session, state);
            }
            case LAST_QUESTION_PROMPT -> {
                // 마지막 질문 유도 멘트 트리거
                triggerLastQuestionPrompt(session, state);
            }
            case IN_PROGRESS -> {
                // [FIX] 시스템 알림이 turn 1을 가로채는 경우가 있어, turnCount가 1 이하인 경우에도 첫 질문 생성을 허용
                if (state.getTurnCount() == null || state.getTurnCount() <= 1) {
                    // Trigger the first question when entering IN_PROGRESS stage
                    triggerFirstQuestion(session, state);
                } else {
                    log.warn(
                            "Skipping first question trigger for interview {} - turnCount is already {}",
                            session.getId(),
                            state.getTurnCount());
                }
            }
            case CLOSING_GREETING -> {
                // CLOSING_GREETING 단계 진입 시 마무리 인사 자동 발화 트리거
                triggerClosingGreeting(session, state);
                // TTS 재생 중 비동기로 리포트 생성 (병렬 실행)
                generateReportInteractor.triggerReportGeneration(session.getId());
            }
            case COMPLETED -> {
                session.complete();
                flushSessionStateToRdb(session);
            }
            case WAITING -> throw new IllegalArgumentException(
                    "Cannot transition back to WAITING stage");
            default -> {} // other stages don't need explicit triggers
        }

        sessionStatePort.saveState(session.getId().toString(), state);
        turnStatePublisher.publish(session.getId().toString(), state);

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

        // Save Adjustment Log (STAGE_FORCE_TRANSITION)
        log.debug(
                "Transitioning stage for interview: {} from {} to {}",
                command.interviewId(),
                previousStage,
                stageEnum);
        saveAdjustmentLogPort.save(
                me.unbrdn.core.interview.domain.entity.InterviewAdjustmentLog.create(
                        session.getId(),
                        "STAGE_FORCE_TRANSITION",
                        previousStage != null ? previousStage.name() : "WAITING",
                        command.newStage(),
                        "Manual or system-triggered stage transition"));

        // Publish Stage Change Event to Redis Pub/Sub so UI updates instantly
        publishTranscriptPort.publish(
                PublishTranscriptCommand.builder()
                        .interviewId(session.getId().toString())
                        .type("STAGE_CHANGE")
                        .currentStage(command.newStage())
                        .previousStage(previousStage != null ? previousStage.name() : "WAITING")
                        .isMaxRetryExceeded(command.isMaxRetryExceeded())
                        .selfIntroRetryCount(
                                state.getSelfIntroRetryCount() != null
                                        ? state.getSelfIntroRetryCount()
                                        : 0)
                        .selfIntroElapsedSeconds(
                                state.getSelfIntroStart() != null
                                        ? (System.currentTimeMillis() - state.getSelfIntroStart())
                                                / 1000
                                        : 0L)
                        .build());
    }

    private void triggerInterviewerIntro(InterviewSession session, InterviewSessionState state) {
        String interviewId = session.getId().toString();

        // Determine participating roles
        List<String> participatingPersonas = state.getParticipatingPersonas();
        if (participatingPersonas == null || participatingPersonas.isEmpty()) {
            log.info(
                    "Personas empty in state. Refreshing from entity for interview: {}",
                    interviewId);
            participatingPersonas = session.getParticipatingPersonas();
            state.setParticipatingPersonas(participatingPersonas);
        }

        if (participatingPersonas == null || participatingPersonas.isEmpty()) {
            log.warn(
                    "Still no personas found in entity for interview: {}. Skipping intro trigger.",
                    interviewId);
            return;
        }

        // 중복 역할이 있다면 한 번만 소개되도록 정규화
        List<String> distinctPersonas = participatingPersonas.stream().distinct().toList();
        state.setParticipatingPersonas(distinctPersonas);
        state.setNextPersonaIndex(0); // 0번(Lead)부터 시작하도록 설정

        /*
         * // [LEGACY] 면접관 순차 소개 로직 비활성화 (프론트엔드 정적 음성 재생으로 대체)
         * state.setStatus(InterviewSessionState.Status.SPEAKING);
         * sessionStatePort.saveState(interviewId, state);
         * turnStatePublisher.publish(interviewId, state);
         */
        log.info(
                "Interviewer intro stage entered. Frontend will handle sequence. interviewId={}",
                interviewId);
    }

    private void handleGreetingReady(InterviewSession session, InterviewSessionState state) {
        log.info(
                "Frontend signaled GREETING ready. Transitioning to CANDIDATE_GREETING. interviewId={}",
                session.getId());
        this.execute(
                new TransitionStageCommand(
                        session.getId(), InterviewStage.CANDIDATE_GREETING.name()));
    }

    private void handleSelfIntroPromptReady(InterviewSession session, InterviewSessionState state) {
        log.info(
                "Frontend signaled SELF_INTRO_PROMPT ready. Transitioning to SELF_INTRO. interviewId={}",
                session.getId());
        this.execute(new TransitionStageCommand(session.getId(), InterviewStage.SELF_INTRO.name()));
    }

    private void handleInterviewerIntroReady(
            InterviewSession session, InterviewSessionState state) {
        String interviewId = session.getId().toString();
        // [FIX] 모든 면접관 소개가 프론트엔드에서 완료되었으므로 바로 자기소개 요청 단계로 이동합니다.
        log.info(
                "Frontend signaled INTERVIEWER_INTRO ready. Transitioning to SELF_INTRO_PROMPT. interviewId={}",
                interviewId);
        this.execute(
                new TransitionStageCommand(
                        session.getId(), InterviewStage.SELF_INTRO_PROMPT.name()));

        /*
         * // [LEGACY] 백엔드 기반 순차 소개 로직 비활성화 List<String> personas =
         * state.getParticipatingPersonas(); int currentIndex =
         * state.getNextPersonaIndex() != null ? state.getNextPersonaIndex() : 0;
         *
         * if (personas == null || currentIndex >= personas.size()) { log.
         * info("All interviewer intros completed. Transitioning to SELF_INTRO_PROMPT. interviewId={}"
         * , interviewId); this.execute(new TransitionStageCommand(session.getId(),
         * InterviewStage.SELF_INTRO_PROMPT.name())); return; }
         *
         * String personaId = personas.get(currentIndex); log.
         * info("Triggering sequential intro for persona: {} ({}/{}). interviewId={}",
         * personaId, currentIndex + 1, personas.size(), interviewId);
         *
         * state.setNextPersonaIndex(currentIndex + 1);
         * state.setLastInterviewerId(personaId);
         * state.setStatus(InterviewSessionState.Status.THINKING);
         * sessionStatePort.saveState(interviewId, state);
         * turnStatePublisher.publish(interviewId, state, personaId);
         *
         * long totalDurationSeconds = session.getScheduledDurationMinutes() * 60L; long
         * remainingTimeSeconds = totalDurationSeconds;
         *
         * CallLlmCommand llmCommand = CallLlmCommand.builder()
         * .interviewId(interviewId) .resumeId(session.getResumeId() != null ?
         * session.getResumeId().toString() : null)
         * .userId(session.getCandidateId().toString())
         * .userText("면접관님, 지원자에게 간단히 본인 소속과 직무 역할만 '한 줄'로 소개하고 즉시 발화를 마쳐주세요. " +
         * "\n[주의]: 다음 질문을 하거나 자기소개를 요청하지 마세요. 오직 본인 소개만 하세요.") .inputRole("system")
         * .personaId(personaId) .forcedSpeakerId(personaId)
         * .mode(session.getType().name()) .companyName(session.getCompanyName())
         * .scheduledDurationMinutes(session.getScheduledDurationMinutes())
         * .stage(state.getCurrentStage()) .domain(session.getDomain())
         * .remainingTimeSeconds(remainingTimeSeconds)
         * .currentDifficultyLevel(state.getCurrentDifficulty())
         * .participatingPersonas(List.of(personaId))
         * .jobPostingUrl(session.getJobPostingUrl()) .build();
         *
         * callLlmPort.generateResponse(llmCommand);
         */
    }

    private void triggerSelfIntroPrompt(InterviewSession session, InterviewSessionState state) {
        log.info(
                "Self intro prompt triggered for interview: {}. Skipping LLM call as client plays recorded audio.",
                session.getId());
        // [FIX] 사용자가 1분 자기소개 요청을 녹음본으로 플레이하므로 서버는 LLM을 호출하지 않습니다.
        // Stage transition(STAGE_CHANGE event)만으로 충분합니다.
    }

    private void triggerFirstQuestion(InterviewSession session, InterviewSessionState state) {
        String interviewId = session.getId().toString();

        // Increment turn count to avoid duplicate key in InterviewQnA
        int newTurnCount = sessionStatePort.incrementTurnCount(interviewId);
        session.incrementTurnCount();
        interviewPort.save(session);
        state.setTurnCount(newTurnCount);

        String userId = session.getCandidateId().toString();

        // Calc time
        long totalDurationSeconds = session.getScheduledDurationMinutes() * 60L;
        long elapsed = 0;
        if (session.getStartedAt() != null) {
            elapsed = Duration.between(session.getStartedAt(), Instant.now()).getSeconds();
        }
        long remainingTimeSeconds = Math.max(0, totalDurationSeconds - elapsed);

        String leadPersona = personaResolver.resolveLeadPersona(state.getParticipatingPersonas());
        state.setLastInterviewerId(leadPersona);
        state.setStatus(InterviewSessionState.Status.THINKING);
        sessionStatePort.saveState(interviewId, state);
        turnStatePublisher.publish(interviewId, state, leadPersona);
        
        log.info("Transitioned to IN_PROGRESS. Triggering first question for interview: {}, turnCount: {}", 
                interviewId, state.getTurnCount());

        CallLlmCommand llmCommand =
                CallLlmCommand.builder()
                        .interviewId(session.getId().toString())
                        .resumeId(
                                session.getResumeId() != null
                                        ? session.getResumeId().toString()
                                        : null)
                        .userId(userId)
                        .userText(
                                "지원자가 다음과 같이 자기소개를 마쳤습니다.\n[지원자 자기소개]\n"
                                        + (state.getSelfIntroText() != null
                                                ? state.getSelfIntroText()
                                                : "(자기소개 내역 없음)")
                                        + "\n\n다음 지침을 [반드시] 따르십시오: "
                                        + "\n1. '자기소개 잘 들었습니다', '수고하셨습니다'와 같은 인사는 **이미 음성으로 재생되었으므로 절대로 반복하지 마십시오**. "
                                        + "\n2. 지원자의 자기소개 내용에 대해 직접 언급하거나 평가하지 말고, **즉각적으로** 이력서 기반의 날카로운 첫 번째 면접 질문을 시작하십시오. "
                                        + "\n3. 질문 전에 면접의 진행 방향을 설명하지 말고 바로 본론으로 들어오십시오. "
                                        + "\n4. 인사말 없이 바로 질문 문장만 생성하십시오.")
                        .inputRole("user")
                        .personaId(leadPersona)
                        .forcedSpeakerId(leadPersona)
                        .mode(session.getType().name())
                        .companyName(session.getCompanyName())
                        .scheduledDurationMinutes(session.getScheduledDurationMinutes())
                        .stage(state.getCurrentStage())
                        .domain(session.getDomain())
                        .remainingTimeSeconds(remainingTimeSeconds)
                        .currentDifficultyLevel(state.getCurrentDifficulty())
                        .lastInterviewerId(leadPersona)
                        .participatingPersonas(
                                personaResolver.resolveLeadOnly(state.getParticipatingPersonas()))
                        .jobPostingUrl(session.getJobPostingUrl())
                        .selfIntroText(state.getSelfIntroText())
                        .build();

        callLlmPort.generateResponse(llmCommand);
    }

    private void triggerClosingGreeting(InterviewSession session, InterviewSessionState state) {
        String interviewId = session.getId().toString();

        // Increment turn count to avoid duplicate key in InterviewQnA
        int newTurnCount = sessionStatePort.incrementTurnCount(interviewId);
        session.incrementTurnCount();
        interviewPort.save(session);
        state.setTurnCount(newTurnCount);

        String userId = session.getCandidateId().toString();

        // Calc time
        long totalDurationSeconds = session.getScheduledDurationMinutes() * 60L;
        long elapsed = 0;
        if (session.getStartedAt() != null) {
            elapsed = Duration.between(session.getStartedAt(), Instant.now()).getSeconds();
        }
        long remainingTimeSeconds = Math.max(0, totalDurationSeconds - elapsed);

        String leadPersona = personaResolver.resolveLeadPersona(state.getParticipatingPersonas());
        state.setLastInterviewerId(leadPersona);
        state.setStatus(InterviewSessionState.Status.THINKING);
        sessionStatePort.saveState(interviewId, state);
        turnStatePublisher.publish(interviewId, state, leadPersona);

        CallLlmCommand llmCommand =
                CallLlmCommand.builder()
                        .interviewId(session.getId().toString())
                        .resumeId(
                                session.getResumeId() != null
                                        ? session.getResumeId().toString()
                                        : null)
                        .userId(userId)
                        .userText("면접이 모두 끝났습니다. 지원자에게 따뜻한 마무리 인사와 함께 면접 종료를 안내해주세요.")
                        .inputRole("system")
                        .personaId(leadPersona)
                        .forcedSpeakerId(leadPersona)
                        .mode(session.getType().name())
                        .companyName(session.getCompanyName())
                        .scheduledDurationMinutes(session.getScheduledDurationMinutes())
                        .stage(state.getCurrentStage())
                        .domain(session.getDomain())
                        .remainingTimeSeconds(remainingTimeSeconds)
                        .currentDifficultyLevel(state.getCurrentDifficulty())
                        .lastInterviewerId(state.getLastInterviewerId())
                        .participatingPersonas(
                                personaResolver.resolveLeadOnly(state.getParticipatingPersonas()))
                        .build();

        callLlmPort.generateResponse(llmCommand);
    }

    private void triggerLastQuestionPrompt(InterviewSession session, InterviewSessionState state) {
        String interviewId = session.getId().toString();
        String userId = session.getCandidateId().toString();

        long totalDurationSeconds = session.getScheduledDurationMinutes() * 60L;
        long elapsed = 0;
        if (session.getStartedAt() != null) {
            elapsed = Duration.between(session.getStartedAt(), Instant.now()).getSeconds();
        }
        long remainingTimeSeconds = Math.max(0, totalDurationSeconds - elapsed);
        String leadPersona = personaResolver.resolveLeadPersona(state.getParticipatingPersonas());
        state.setLastInterviewerId(leadPersona);
        state.setStatus(InterviewSessionState.Status.THINKING);
        sessionStatePort.saveState(interviewId, state);
        turnStatePublisher.publish(interviewId, state, leadPersona);

        CallLlmCommand llmCommand =
                CallLlmCommand.builder()
                        .interviewId(interviewId)
                        .resumeId(
                                session.getResumeId() != null
                                        ? session.getResumeId().toString()
                                        : null)
                        .userId(userId)
                        .userText(
                                "이제 면접의 마지막 질문까지 모두 끝났습니다. 지원자에게 마지막으로 하고 싶은 말이나 궁금한 점이 있는지 정중하게 물어봐주세요.")
                        .inputRole("system")
                        .personaId(leadPersona)
                        .forcedSpeakerId(leadPersona)
                        .mode(session.getType().name())
                        .companyName(session.getCompanyName())
                        .scheduledDurationMinutes(session.getScheduledDurationMinutes())
                        .stage(state.getCurrentStage())
                        .domain(session.getDomain())
                        .remainingTimeSeconds(remainingTimeSeconds)
                        .currentDifficultyLevel(state.getCurrentDifficulty())
                        .lastInterviewerId(leadPersona)
                        .participatingPersonas(
                                personaResolver.resolveLeadOnly(state.getParticipatingPersonas()))
                        .round(session.getRound())
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

    private InterviewSessionState.Status determineInitialStatus(InterviewStage stage) {
        return switch (stage) {
            case CANDIDATE_GREETING, SELF_INTRO, LAST_ANSWER -> InterviewSessionState.Status
                    .LISTENING;
            case GREETING, INTERVIEWER_INTRO, SELF_INTRO_PROMPT -> InterviewSessionState.Status
                    .SPEAKING;
            case COMPLETED -> InterviewSessionState.Status.COMPLETED;
            default -> InterviewSessionState.Status.THINKING;
        };
    }
}
