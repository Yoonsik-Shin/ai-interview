package me.unbrdn.core.auth.application.port.out;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface OAuthUserPort {

    Optional<UUID> findUserIdByProviderAndProviderUserId(String provider, String providerUserId);

    void saveOAuthLink(
            UUID userId, String provider, String providerUserId,
            String accessToken, Instant tokenExpiresAt);
}
