package me.unbrdn.core.interview.application.port.out;

public interface SaveSentenceStreamPort {
    void publishSentence(
            String interviewId,
            String personaId,
            int sentenceIndex,
            String sentence,
            boolean isFinal,
            String mode);
}
