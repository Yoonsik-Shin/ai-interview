package me.unbrdn.core.interview.application.port.out;

import me.unbrdn.core.interview.domain.enums.MessageRole;
import me.unbrdn.core.interview.domain.enums.MessageSource;

public interface SaveSentenceStreamPort {
    void publishSentence(
            String interviewId,
            String personaId,
            int sentenceIndex,
            String sentence,
            boolean isFinal,
            String mode,
            Integer difficultyLevel,
            Integer turnCount,
            String stage,
            MessageRole role,
            MessageSource source);
}
