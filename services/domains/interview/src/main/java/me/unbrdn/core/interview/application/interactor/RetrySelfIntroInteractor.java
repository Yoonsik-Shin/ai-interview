package me.unbrdn.core.interview.application.interactor;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.port.in.RetrySelfIntroUseCase;
import me.unbrdn.core.interview.application.port.in.TransitionInterviewStageUseCase;
import me.unbrdn.core.interview.application.port.out.ManageSessionStatePort;
import me.unbrdn.core.interview.domain.enums.InterviewStage;
import me.unbrdn.core.interview.domain.model.InterviewSessionState;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.application.port.out.SaveInterviewMessagePort;
import me.unbrdn.core.interview.application.support.PersonaResolver;
import me.unbrdn.core.interview.domain.entity.InterviewMessage;
import me.unbrdn.core.interview.domain.enums.MessageRole;
import me.unbrdn.core.interview.domain.enums.MessageSource;
import me.unbrdn.core.interview.application.support.TurnStatePublisher;

@Slf4j
@Service
@RequiredArgsConstructor
public class RetrySelfIntroInteractor implements RetrySelfIntroUseCase {

    private final ManageSessionStatePort sessionStatePort;
    private final TransitionInterviewStageUseCase transitionInterviewStageUseCase;
    private final InterviewPort interviewPort;
    private final SaveInterviewMessagePort saveInterviewMessagePort;
    private final PersonaResolver personaResolver;
    private final TurnStatePublisher turnStatePublisher;

    @Override
    @Transactional
    public Result execute(UUID interviewId, int durationSeconds) {
        String idStr = interviewId.toString();
        InterviewSessionState state =
                sessionStatePort.getState(idStr).orElseGet(InterviewSessionState::createDefault);

        int currentCount =
                state.getSelfIntroRetryCount() != null ? state.getSelfIntroRetryCount() : 0;

        // [FIX] 3회 시도(리트라이 2회) 초과 시 혹은 1분 30초 초과 시 강제 전이
        boolean isTimeOut = durationSeconds >= 90;
        boolean isMaxAttemptReached = currentCount >= 2;

        if (isMaxAttemptReached || isTimeOut) {
            log.info(
                    "Forcing self-intro completion for interview {}. Reason: maxAttempts={}, isTimeOut={}",
                    idStr,
                    isMaxAttemptReached,
                    isTimeOut);

            interviewPort.loadById(interviewId).ifPresent(session -> {
                try {
                    // [FIX] Save AI transition message directly to DB (Turn 0, Seq 2 if max retry, else 0)
                    int seq = isMaxAttemptReached ? 2 : 0;
                    String content = isMaxAttemptReached 
                        ? "시간 관계상 자기소개는 여기까지 듣고 바로 면접관의 질문을 시작하겠습니다."
                        : "좋습니다 자기소개 잘 들었습니다. 이제 본격적으로 면접을 시작해보겠습니다.";
                    
                    InterviewMessage aiMsg = InterviewMessage.create(
                            session, 0, seq, InterviewStage.SELF_INTRO,
                            MessageRole.AI, MessageSource.SYSTEM, content,
                            null, personaResolver.resolveLeadPersona(state.getParticipatingPersonas()),
                            state.getCurrentDifficulty() != null ? state.getCurrentDifficulty() : 3);
                    saveInterviewMessagePort.save(aiMsg);
                } catch (Exception e) {
                    log.error("Failed to persist force transition message in RetrySelfIntroInteractor", e);
                }
            });

            transitionInterviewStageUseCase.execute(
                    new TransitionInterviewStageUseCase.TransitionStageCommand(
                            interviewId, InterviewStage.IN_PROGRESS.name()));

            return Result.builder().newRetryCount(currentCount).isMaxRetryExceeded(true).build();
        }

        // [FIX] Atomic Increment for Retry Count to prevent race conditions
        int newCount = sessionStatePort.incrementSelfIntroRetryCount(idStr);
        boolean isMaxExceeded = newCount >= 2;

        state.setSelfIntroRetryCount(newCount);
        // [FIX] 리트라이 시작 시 상태를 LISTENING으로 돌려주어 UI가 대기 상태로 빠지는 것 방지
        state.setStatus(me.unbrdn.core.interview.domain.model.InterviewSessionState.Status.LISTENING);
        // Reset base timing to now for the next try
        state.setSelfIntroStart(System.currentTimeMillis());
        state.setLastRetryAt(System.currentTimeMillis());
        state.setCanCandidateSpeak(true); // [FIX] 리트라이 시 발화 권한 부여

        sessionStatePort.saveState(idStr, state);
        turnStatePublisher.publish(idStr, state); // [FIX] 실시간 상태 동기화를 위해 이벤트 발행

        // [FIX] Save AI retry message directly to DB (Turn 0)
        interviewPort.loadById(interviewId).ifPresent(session -> {
            try {
                InterviewMessage retryMsg = InterviewMessage.create(
                        session, 0, newCount - 1, InterviewStage.SELF_INTRO,
                        MessageRole.AI, MessageSource.SYSTEM,
                        "답변이 너무 짧습니다. 내용을 조금 더 구체적으로 말씀해 주시겠어요?",
                        null, personaResolver.resolveLeadPersona(state.getParticipatingPersonas()),
                        state.getCurrentDifficulty() != null ? state.getCurrentDifficulty() : 3);
                saveInterviewMessagePort.save(retryMsg);
            } catch (Exception e) {
                log.error("Failed to persist retry message in RetrySelfIntroInteractor", e);
            }
        });

        log.info(
                "Self-introduction retry for interview {}: count {} -> {}, duration={}s, isMaxExceeded={}",
                idStr,
                currentCount,
                newCount,
                durationSeconds,
                isMaxExceeded);

        return Result.builder().newRetryCount(newCount).isMaxRetryExceeded(isMaxExceeded).build();
    }
}
