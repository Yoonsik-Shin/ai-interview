package me.unbrdn.core.interview.application.port.out;

import me.unbrdn.core.interview.application.dto.command.PublishResponseCompletedCommand;

public interface PublishResponseCompletedPort {
    void publish(PublishResponseCompletedCommand command);
}
