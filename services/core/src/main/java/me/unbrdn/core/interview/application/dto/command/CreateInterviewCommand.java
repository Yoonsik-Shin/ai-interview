package me.unbrdn.core.interview.application.dto.command;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.Builder;
import lombok.Getter;

// ...

// ...
@Getter
@Builder
public class CreateInterviewCommand {
    private final UUID userId;
    private final Optional<UUID> resumeId; // Optional - 이력서 없이도 면접 가능
    private final String domain;
    private final String type;
    private final List<String> roles;
    private final String personality;
    private final int interviewerCount;
    private final int targetDurationMinutes;
    private final String selfIntroduction;
}
