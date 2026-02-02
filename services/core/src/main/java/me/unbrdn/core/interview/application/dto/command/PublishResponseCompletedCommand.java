package me.unbrdn.core.interview.application.dto.command;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class PublishResponseCompletedCommand {
    private final String interviewId;
    private final long timestamp;
}
