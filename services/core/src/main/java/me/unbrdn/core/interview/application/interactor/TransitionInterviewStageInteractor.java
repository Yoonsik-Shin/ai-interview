package me.unbrdn.core.interview.application.interactor;

import java.util.List;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.application.dto.command.CallLlmCommand;
import me.unbrdn.core.interview.application.port.in.TransitionInterviewStageUseCase;
import me.unbrdn.core.interview.application.port.out.CallLlmPort;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.application.port.out.ManageConversationHistoryPort;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import me.unbrdn.core.interview.domain.model.ConversationHistory;
import org.springframework.stereotype.Service;

/** 면접 세션의 Stage 전환 Interactor */
@Service
@RequiredArgsConstructor
public class TransitionInterviewStageInteractor implements TransitionInterviewStageUseCase {

    private final InterviewPort interviewPort;
    private final CallLlmPort callLlmPort;
    private final ManageConversationHistoryPort manageConversationHistoryPort;

    @Override
    public void execute(TransitionStageCommand command) {
        InterviewSession session = interviewPort.loadById(command.interviewSessionId()).orElseThrow(
                () -> new IllegalArgumentException("Interview session not found: " + command.interviewSessionId()));

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
        case IN_PROGRESS -> session.transitionToInProgress();
        case COMPLETED -> session.transitionToCompleted();
        case WAITING -> throw new IllegalArgumentException("Cannot transition back to WAITING stage");
        default -> throw new IllegalArgumentException("Unknown stage: " + command.newStage());
        }

        interviewPort.save(session);
    }

    private void triggerInterviewerIntro(InterviewSession session) {
        String interviewId = session.getSessionUuid();
        // Candidate Entity가 BaseEntity를 상속받아 UUID id를 가짐
        String userId = session.getCandidate().getId().toString();

        // 이전 대화 내역 로드 (아마도 없을 수 있지만 일관성을 위해 로드)
        List<ConversationHistory> history = manageConversationHistoryPort.loadHistory(interviewId);

        // LLM 호출 커맨드 생성 (Auto Trigger)
        CallLlmCommand llmCommand = CallLlmCommand.builder().interviewId(interviewId).userId(userId).userText(".") // 트리거용
                                                                                                                   // 더미
                                                                                                                   // 텍스트
                                                                                                                   // (LLM
                                                                                                                   // 서비스에서
                                                                                                                   // Stage
                                                                                                                   // 기반으로
                                                                                                                   // 프롬프트
                                                                                                                   // 처리)
                .persona(session.getPersona().name()).history(history).mode(session.getType().name())
                .stage(session.getStage()).interviewerCount(session.getInterviewerCount()).domain(session.getDomain())
                .build();

        callLlmPort.generateResponse(llmCommand);
    }
}
