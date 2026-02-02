package me.unbrdn.core.interview.application.dto.command;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class PublishTranscriptCommand {
    private final String interviewId;
    private final String token;
    private final String thinking;
}
