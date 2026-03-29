package me.unbrdn.core.interview.application.interactor;

import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.dto.command.CallLlmCommand;
import me.unbrdn.core.interview.application.event.InterviewerIntroFinishedEvent;
import me.unbrdn.core.interview.application.port.out.CallLlmPort;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.application.port.out.ManageSessionStatePort;
import me.unbrdn.core.interview.application.support.PersonaResolver;
import me.unbrdn.core.interview.application.support.TurnStatePublisher;
import me.unbrdn.core.interview.domain.enums.InterviewStage;
import me.unbrdn.core.interview.domain.model.InterviewSessionState;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class InterviewSequentialIntroListener {

    private final InterviewPort interviewPort;
    private final CallLlmPort callLlmPort;
    private final ManageSessionStatePort sessionStatePort;
    private final me.unbrdn.core.interview.application.port.in.TransitionInterviewStageUseCase
            transitionInterviewStageUseCase;
    private final PersonaResolver personaResolver;
    private final TurnStatePublisher turnStatePublisher;

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

                                                    log.info(
                                                            "Triggering next sequential interviewer intro: {}",
                                                            nextRoleName);

                                                    // Increment turn count to avoid duplicate key
                                                    // in InterviewQnA
                                                    int newTurnCount =
                                                            sessionStatePort.incrementTurnCount(
                                                                    event.getInterviewId());
                                                    session.incrementTurnCount();
                                                    interviewPort.save(session);
                                                    state.setTurnCount(newTurnCount);

                                                    long totalDurationSeconds =
                                                            session.getScheduledDurationMinutes()
                                                                    * 60L;
                                                    long remainingTimeSeconds =
                                                            totalDurationSeconds;

                                                    CallLlmCommand llmCommand =
                                                            CallLlmCommand.builder()
                                                                    .interviewId(
                                                                            session.getId()
                                                                                    .toString())
                                                                    .resumeId(
                                                                            session.getResumeId()
                                                                                            != null
                                                                                    ? session.getResumeId()
                                                                                            .toString()
                                                                                    : null)
                                                                    .userId(event.getUserId())
                                                                    .userText(
                                                                            "앞선 면접관의 소개가 끝났습니다. 이제 면접관님의 차례입니다. 지원자에게 짧고 밝게 본인 소속과 직무 역할만 소개하고 즉시 발화를 마쳐주세요. "
                                                                                    + "\n**[절대 금지 사항]**: "
                                                                                    + "\n1. '이제 자기소개를 해주세요' 또는 '1분 자기소개 부탁드린다'는 등의 다음 단계 안내를 절대 하지 마십시오. "
                                                                                    + "\n2. 지원자에게 질문을 던지지 마십시오. "
                                                                                    + "\n\n**[답변 예시]**: '안녕하세요. 이번 면접에서 기술적인 역량을 함께 점검할 기술 면접관입니다. 잘 부탁드립니다.'")
                                                                    .inputRole("system")
                                                                    .personaId(nextRoleName)
                                                                    .forcedSpeakerId(nextRoleName)
                                                                    .mode(event.getMode())
                                                                    .companyName(
                                                                            session
                                                                                    .getCompanyName())
                                                                    .scheduledDurationMinutes(
                                                                            session
                                                                                    .getScheduledDurationMinutes())
                                                                    .stage(state.getCurrentStage())
                                                                    .domain(session.getDomain())
                                                                    .remainingTimeSeconds(
                                                                            remainingTimeSeconds)
                                                                    .currentDifficultyLevel(
                                                                            state
                                                                                    .getCurrentDifficulty())
                                                                    .lastInterviewerId(
                                                                            state
                                                                                    .getLastInterviewerId())
                                                                    .participatingPersonas(
                                                                            List.of(nextRoleName))
                                                                    .round(session.getRound())
                                                                    .build(); // 현재
                                                    // 소개할
                                                    // 면접관만
                                                    // 전달
                                                    // (LLM은 roles[0]을 화자로
                                                    // 사용)

                                                    // [동시성 가드] 상태 업데이트를 호출 이전에 실행하여 중복 트리거를 방지합니다.
                                                    state.setNextPersonaIndex(nextIdx + 1);
                                                    state.setLastInterviewerId(nextRoleName);
                                                    state.setStatus(
                                                            InterviewSessionState.Status.THINKING);
                                                    sessionStatePort.saveState(
                                                            event.getInterviewId(), state);
                                                    turnStatePublisher.publish(
                                                            event.getInterviewId(),
                                                            state,
                                                            nextRoleName);

                                                    callLlmPort.generateResponse(llmCommand);
                                                } else {
                                                    log.info(
                                                            "All interviewers introduced. Transitioning to SELF_INTRO_PROMPT.");

                                                    if (personas != null && !personas.isEmpty()) {
                                                        state.setLastInterviewerId(
                                                                personaResolver.resolveLeadPersona(
                                                                        personas));
                                                        sessionStatePort.saveState(
                                                                event.getInterviewId(), state);
                                                    }

                                                    // [FIX] 사용자가 1분 자기소개 요청을 녹음본으로 플레이하므로,
                                                    // 여기서 LLM에게 자기소개 요청을 시키지 않고 바로 단계만 전환합니다.
                                                    // 클라이언트는 SELF_INTRO_PROMPT 단계로의 STAGE_CHANGE
                                                    // 이벤트를 받고
                                                    // 자체 녹음본을 재생한 뒤 SELF_INTRO로 넘어갈 것입니다.
                                                    transitionInterviewStageUseCase.execute(
                                                            new me.unbrdn.core.interview.application
                                                                    .port.in
                                                                    .TransitionInterviewStageUseCase
                                                                    .TransitionStageCommand(
                                                                    interviewId,
                                                                    InterviewStage.SELF_INTRO_PROMPT
                                                                            .name()));
                                                }
                                            }
                                        });
                    });
        } catch (Exception e) {
            log.error("Failed to handle sequential interviewer intro via event", e);
        }
    }
}
