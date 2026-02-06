package me.unbrdn.core.resume.application.dto;

import java.util.UUID;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class GetUploadUrlCommand {
    private final UUID userId;
    private final String fileName;
    private final String title;
}
