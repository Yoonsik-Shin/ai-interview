package me.unbrdn.core.auth.application.interactor.dto.result;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class LoginWithOAuthResult {
    private final boolean isNewUser;
    /** 신규 유저: 5분 유효 pending token */
    private final String pendingToken;
    /** 기존 유저: 발급된 JWT 인증 결과 */
    private final AuthenticateUserResult auth;
}
