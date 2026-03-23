package me.unbrdn.core.user.domain.entity;

import java.io.Serializable;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.auth.domain.entity.OauthProvider;

/**
 * 유저 연동 소셜로그인 플랫폼 엔티티
 *
 * <p>복합키 클래스 UserOauthsId를 사용함
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserOauths {

    private UserOauthsId id;

    private User user;

    private OauthProvider provider;

    private String providerUserId;

    private String accessToken;

    private LocalDateTime tokenExpiresAt;

    private UserOauths(
            User user,
            OauthProvider provider,
            String providerUserId,
            String accessToken,
            LocalDateTime tokenExpiresAt) {
        this.id = new UserOauthsId(user.getId(), provider.getId());
        this.user = user;
        this.provider = provider;
        this.providerUserId = providerUserId;
        this.accessToken = accessToken;
        this.tokenExpiresAt = tokenExpiresAt;
    }

    /** 새로운 OAuth 연동 생성 */
    public static UserOauths create(
            User user,
            OauthProvider provider,
            String providerUserId,
            String accessToken,
            LocalDateTime tokenExpiresAt) {
        return new UserOauths(user, provider, providerUserId, accessToken, tokenExpiresAt);
    }

    /** 토큰 업데이트 */
    public void updateToken(String accessToken, LocalDateTime tokenExpiresAt) {
        this.accessToken = accessToken;
        this.tokenExpiresAt = tokenExpiresAt;
    }

    /** 토큰 만료 여부 확인 */
    public boolean isTokenExpired() {
        return LocalDateTime.now().isAfter(this.tokenExpiresAt);
    }

    /** 복합키 클래스 */
    @Getter
    @NoArgsConstructor(access = AccessLevel.PROTECTED)
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class UserOauthsId implements Serializable {
        private java.util.UUID userId;
        private java.util.UUID providerId;
    }
}
