package me.unbrdn.core.interview.adapter.in.messaging;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class InterviewResultEvent {
    private String eventType;
    private Integer interviewId;
    private String userId;
    private String userAnswer;
    private String aiAnswer;
    private String traceId;
}
