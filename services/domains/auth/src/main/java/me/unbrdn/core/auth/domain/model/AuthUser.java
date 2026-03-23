package me.unbrdn.core.auth.domain.model;

import java.util.UUID;
import lombok.Builder;
import lombok.Getter;

/** Auth 서비스에서 사용하는 사용자 정보 */
@Getter
@Builder
public class AuthUser {
    private final UUID id;
    private final String email;
    private final String passwordHash;
    private final String nickname;
    private final String role;
    private final String phoneNumber;
    private final String profileImageUrl;
}
