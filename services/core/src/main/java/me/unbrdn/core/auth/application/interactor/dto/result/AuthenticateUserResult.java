package me.unbrdn.core.auth.application.interactor.dto.result;

import lombok.Builder;
import lombok.Getter;

/** 사용자 인증 결과 DTO */
@Getter
@Builder
public class AuthenticateUserResult {

    private final String accessToken;
    private final String refreshToken;
    private final AuthenticatedUser user;
}
