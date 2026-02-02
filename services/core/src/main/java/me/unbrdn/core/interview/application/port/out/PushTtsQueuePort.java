package me.unbrdn.core.interview.application.port.out;

import me.unbrdn.core.interview.application.dto.command.PushTtsQueueCommand;

/** TTS 문장을 Redis Queue에 Push하기 위한 Port */
public interface PushTtsQueuePort {
    void push(PushTtsQueueCommand command);
}
