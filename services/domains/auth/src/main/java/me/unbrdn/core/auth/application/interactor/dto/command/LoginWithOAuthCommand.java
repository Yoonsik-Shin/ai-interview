package me.unbrdn.core.auth.application.interactor.dto.command;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class LoginWithOAuthCommand {
    private final String provider;
    private final String providerUserId;
    private final String accessToken;
    private final long tokenExpiresAt;
    private final String email;
    private final String name;
    private final String pictureUrl;
}
