package me.unbrdn.core.auth.application.interactor.dto.command;

import lombok.Builder;
import lombok.Getter;

/** 토큰 재발급 명령 DTO */
@Getter
@Builder
public class RefreshTokenCommand {
    private final String refreshToken;
}
