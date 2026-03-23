package me.unbrdn.core.interview.application.dto.command;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CreateInterviewCommand {
    private final UUID userId;
    private final Optional<UUID> resumeId;
    private final String companyName;
    private final String domain;
    private final String type;
    private final List<String> roles;
    private final int scheduledDurationMinutes;
}
