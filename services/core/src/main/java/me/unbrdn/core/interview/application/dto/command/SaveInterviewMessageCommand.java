package me.unbrdn.core.interview.application.dto.command;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SaveInterviewMessageCommand {
    private String interviewId;
    private String personaId;
    private int sentenceIndex;
    private String sentence;
    private boolean isFinal;
}
