package me.unbrdn.core.auth.application.port.out;

import java.util.Optional;

public interface RefreshTokenPort {
    void saveRefreshToken(String userId, String refreshToken);

    Optional<String> loadRefreshToken(String userId);
}
