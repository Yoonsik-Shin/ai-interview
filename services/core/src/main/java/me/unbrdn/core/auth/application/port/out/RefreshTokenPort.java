package me.unbrdn.core.auth.application.port.out;

import java.util.Optional;

public interface RefreshTokenPort {
    /**
     * 리프레시 토큰 저장
     *
     * @param userId       사용자 ID
     * @param refreshToken 리프레시 토큰
     */
    void saveRefreshToken(String userId, String refreshToken);

    /**
     * 리프레시 토큰 조회
     *
     * @param userId 사용자 ID
     * @return 리프레시 토큰
     */
    Optional<String> loadRefreshToken(String userId);
}
