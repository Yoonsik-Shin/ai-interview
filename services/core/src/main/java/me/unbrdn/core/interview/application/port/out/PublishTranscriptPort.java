package me.unbrdn.core.interview.application.port.out;

import me.unbrdn.core.interview.application.dto.command.PublishTranscriptCommand;

/** Redis Pub/Sub으로 실시간 자막 발행을 위한 Port */
public interface PublishTranscriptPort {
    void publish(PublishTranscriptCommand command);
}
