package me.unbrdn.core.interview.application.dto.command;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.Builder;
import lombok.Getter;
import me.unbrdn.core.interview.domain.enums.InterviewRound;
import me.unbrdn.core.interview.domain.enums.InterviewType;

@Getter
@Builder
public class CreateInterviewCommand {
    private final UUID userId;
    private final Optional<UUID> resumeId;
    private final String companyName;
    private final String domain;
    private final InterviewType type;
    private final InterviewRound round;
    private final List<String> roles;
    private final int scheduledDurationMinutes;
    private final String jobPostingUrl;
    private final String selfIntroText;
}
