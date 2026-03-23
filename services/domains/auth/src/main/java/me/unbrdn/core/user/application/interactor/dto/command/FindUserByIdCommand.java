package me.unbrdn.core.user.application.interactor.dto.command;

import java.util.UUID;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class FindUserByIdCommand {
    private final UUID userId;
}
