package me.unbrdn.core.interview.application.dto.command;

import lombok.Builder;
import lombok.Data;
import me.unbrdn.core.interview.domain.enums.MessageRole;
import me.unbrdn.core.interview.domain.enums.MessageSource;

@Data
@Builder
public class SaveInterviewMessageCommand {
    private String interviewId;
    private String personaId;
    private MessageRole role;
    private MessageSource source;
    private Integer turnCount;
    private int sentenceIndex;
    private String sentence;
    private boolean isFinal;
    private Integer difficultyLevel;
    private String stage;
}
