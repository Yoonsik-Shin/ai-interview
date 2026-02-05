package me.unbrdn.core.interview.application.port.out;

import me.unbrdn.core.interview.application.dto.command.CallLlmCommand;

/** LLM 서비스 호출을 위한 Port Hexagonal Architecture - Output Port */
public interface CallLlmPort {
    void generateResponse(CallLlmCommand command);

    void generateResponseSync(CallLlmCommand command);
}
