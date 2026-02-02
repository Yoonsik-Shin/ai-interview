package me.unbrdn.core.user.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.auth.domain.entity.OauthProvider;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * 유저 연동 소셜로그인 플랫폼 엔티티
 *
 * <p>복합키(@EmbeddedId)를 사용하므로 BaseEntity를 상속받지 않음 ID는 UserOauthsId로 관리됨
 */
@Entity
@Table(name = "user_oauths")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@EntityListeners(AuditingEntityListener.class)
public class UserOauths {

    @EmbeddedId private UserOauthsId id;

    @MapsId("userId")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @MapsId("providerId")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "provider_id", nullable = false)
    private OauthProvider provider;

    @Column(name = "provider_user_id", nullable = false, length = 255)
    private String providerUserId;

    @Column(name = "access_token", nullable = false, length = 500)
    private String accessToken;

    @Column(name = "token_expires_at", nullable = false)
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
    @Embeddable
    @Getter
    @NoArgsConstructor(access = AccessLevel.PROTECTED)
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class UserOauthsId implements Serializable {
        @Column(name = "user_id", columnDefinition = "uuid")
        private java.util.UUID userId;

        @Column(name = "provider_id", columnDefinition = "uuid")
        private java.util.UUID providerId;
    }
}
