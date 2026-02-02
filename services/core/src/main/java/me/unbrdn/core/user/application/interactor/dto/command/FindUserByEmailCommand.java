package me.unbrdn.core.user.application.interactor.dto.command;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class FindUserByEmailCommand {
    private final String email;
}
