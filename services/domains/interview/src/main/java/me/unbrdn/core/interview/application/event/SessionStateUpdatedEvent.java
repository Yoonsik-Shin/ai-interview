package me.unbrdn.core.interview.application.event;

import lombok.Getter;
import me.unbrdn.core.interview.domain.model.InterviewSessionState;
import org.springframework.context.ApplicationEvent;

@Getter
public class SessionStateUpdatedEvent extends ApplicationEvent {

    private final String interviewId;
    private final InterviewSessionState state;

    public SessionStateUpdatedEvent(
            Object source, String interviewId, InterviewSessionState state) {
        super(source);
        this.interviewId = interviewId;
        this.state = state;
    }
}
