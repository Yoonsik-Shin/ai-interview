package me.unbrdn.core.auth.application.interactor.dto.command;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CompleteOAuthProfileCommand {
    private final String pendingToken;
    private final String role;
    private final String phoneNumber;
    private final String nickname;
    private final String password;
}
