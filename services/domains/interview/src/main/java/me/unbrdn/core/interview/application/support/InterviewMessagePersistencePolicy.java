package me.unbrdn.core.interview.application.support;

import me.unbrdn.core.interview.domain.enums.InterviewStage;
import me.unbrdn.core.interview.domain.enums.MessageRole;
import org.springframework.stereotype.Component;

@Component
public class InterviewMessagePersistencePolicy {

    public boolean shouldPersist(InterviewStage stage, MessageRole role) {
        if (stage == null || role == null) {
            return false;
        }

        return switch (stage) {
            case SELF_INTRO,
                    IN_PROGRESS,
                    LAST_QUESTION_PROMPT,
                    LAST_ANSWER,
                    CLOSING_GREETING,
                    COMPLETED -> true;
            case WAITING,
                    GREETING,
                    CANDIDATE_GREETING,
                    INTERVIEWER_INTRO,
                    SELF_INTRO_PROMPT -> false;
        };
    }
}
