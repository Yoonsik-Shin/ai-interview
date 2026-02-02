package me.unbrdn.core.auth.application.interactor.dto.result;

import java.util.UUID;
import lombok.Builder;
import lombok.Getter;

/** 인증된 사용자 정보 DTO */
@Getter
@Builder
public class AuthenticatedUser {
    private final UUID id;
    private final String email;
    private final String role;
    private final String nickname;
    private final String phoneNumber;
    private final String profileImageUrl;
}
