package me.unbrdn.core.interview.application.dto.command;

import java.util.Optional;
import java.util.UUID;
import lombok.Builder;
import lombok.Getter;
import me.unbrdn.core.interview.domain.enums.InterviewPersona;
import me.unbrdn.core.interview.domain.enums.InterviewType;

@Getter
@Builder
public class CreateInterviewCommand {
    private final UUID userId;
    private final Optional<UUID> resumeId; // Optional - 이력서 없이도 면접 가능
    private final String domain;
    private final InterviewType type;
    private final InterviewPersona persona;
    private final int interviewerCount;
    private final int targetDurationMinutes;
    private final String selfIntroduction;
}
