package me.unbrdn.core.auth.adapter.out.persistence;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.auth.adapter.out.persistence.entity.OauthProviderJpaEntity;
import me.unbrdn.core.auth.adapter.out.persistence.repository.OauthProviderJpaRepository;
import me.unbrdn.core.auth.application.port.out.OAuthUserPort;
import me.unbrdn.core.user.adapter.out.persistence.entity.UserJpaEntity;
import me.unbrdn.core.user.adapter.out.persistence.entity.UserOauthsJpaEntity;
import me.unbrdn.core.user.adapter.out.persistence.entity.UserOauthsJpaEntity.UserOauthsId;
import me.unbrdn.core.user.adapter.out.persistence.repository.UserJpaRepository;
import me.unbrdn.core.user.adapter.out.persistence.repository.UserOauthsJpaRepository;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class OAuthUserPersistenceAdapter implements OAuthUserPort {

    private final OauthProviderJpaRepository oauthProviderRepository;
    private final UserOauthsJpaRepository userOauthsRepository;
    private final UserJpaRepository userJpaRepository;

    @Override
    public Optional<UUID> findUserIdByProviderAndProviderUserId(
            String provider, String providerUserId) {
        return oauthProviderRepository
                .findByCompanyName(provider)
                .flatMap(p -> userOauthsRepository.findByProviderIdAndProviderUserId(
                        p.getId(), providerUserId))
                .map(oauth -> oauth.getId().getUserId());
    }

    @Override
    public void saveOAuthLink(
            UUID userId, String provider, String providerUserId,
            String accessToken, Instant tokenExpiresAt) {
        OauthProviderJpaEntity providerEntity = oauthProviderRepository
                .findByCompanyName(provider)
                .orElseThrow(() -> new IllegalArgumentException("지원하지 않는 OAuth 제공자입니다: " + provider));

        UserJpaEntity userEntity = userJpaRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 유저입니다: " + userId));

        UserOauthsId compositeId = new UserOauthsId(userId, providerEntity.getId());

        UserOauthsJpaEntity oauthLink = UserOauthsJpaEntity.builder()
                .id(compositeId)
                .user(userEntity)
                .provider(providerEntity)
                .providerUserId(providerUserId)
                .accessToken(accessToken)
                .tokenExpiresAt(LocalDateTime.ofInstant(tokenExpiresAt, ZoneOffset.UTC))
                .build();

        userOauthsRepository.save(oauthLink);
    }
}
