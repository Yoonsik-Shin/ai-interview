package me.unbrdn.core.auth.application.interactor.dto.command;

import lombok.Builder;
import lombok.Getter;

/** 사용자 인증 명령 DTO */
@Getter
@Builder
public class AuthenticateUserCommand {
    private final String email;
    private final String password;
}
