package me.unbrdn.core.interview.application.interactor;

import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.dto.command.CallLlmCommand;
import me.unbrdn.core.interview.application.dto.command.ProcessUserAnswerCommand;
import me.unbrdn.core.interview.application.port.in.ProcessUserAnswerUseCase;
import me.unbrdn.core.interview.application.port.out.CallLlmPort;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.application.port.out.ManageConversationHistoryPort;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import me.unbrdn.core.interview.domain.model.ConversationHistory;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProcessUserAnswerInteractor implements ProcessUserAnswerUseCase {

    private final ManageConversationHistoryPort conversationHistoryPort;
    private final CallLlmPort callLlmPort;
    private final InterviewPort interviewPort;

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

        String mode =
                interviewSession
                        .getType()
                        .name()
                        .toLowerCase(); // REAL -> "real", PRACTICE -> "practice"

        // 2. 대화 히스토리 로드
        List<ConversationHistory> history =
                conversationHistoryPort.loadHistory(command.getInterviewId());

        // 3. LLM 호출 (스트리밍)
        CallLlmCommand llmCommand =
                CallLlmCommand.builder()
                        .interviewId(command.getInterviewId())
                        .interviewSessionId(interviewSession.getId().toString())
                        .userId(command.getUserId())
                        .userText(command.getUserText())
                        .persona(interviewSession.getPersona().name())
                        .history(history)
                        .mode(mode)
                        .stage(interviewSession.getStage())
                        .interviewerCount(interviewSession.getInterviewerCount())
                        .domain(interviewSession.getDomain())
                        .build();

        callLlmPort.generateResponse(llmCommand);
    }
}
