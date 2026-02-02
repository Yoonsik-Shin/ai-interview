package me.unbrdn.core.interview.application.port.in;

import me.unbrdn.core.interview.application.dto.command.ProcessLlmTokenCommand;

/** LLM 토큰 처리 Use Case LLM 스트리밍 응답을 받아 Redis/DB에 저장 */
public interface ProcessLlmTokenUseCase {
    void execute(ProcessLlmTokenCommand command);
}
