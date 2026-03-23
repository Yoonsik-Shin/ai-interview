package me.unbrdn.core.auth.application.interactor.dto.result;

import lombok.Builder;
import lombok.Getter;

/** 토큰 재발급 결과 DTO */
@Getter
@Builder
public class RefreshTokenResult {
    private final String accessToken;
    private final String refreshToken;
}
