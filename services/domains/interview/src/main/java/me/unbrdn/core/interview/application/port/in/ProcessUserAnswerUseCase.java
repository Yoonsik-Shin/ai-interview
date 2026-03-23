package me.unbrdn.core.interview.application.port.in;

import me.unbrdn.core.interview.application.dto.command.ProcessUserAnswerCommand;

/** 사용자 답변 처리 Use Case STT 결과를 받아 LLM에 전달 */
public interface ProcessUserAnswerUseCase {
    void execute(ProcessUserAnswerCommand command);
}
