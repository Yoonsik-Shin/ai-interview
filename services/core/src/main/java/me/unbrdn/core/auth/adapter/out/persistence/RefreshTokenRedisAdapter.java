package me.unbrdn.core.auth.adapter.out.persistence;

import java.time.Duration;
import java.util.Optional;
import me.unbrdn.core.auth.application.port.out.RefreshTokenPort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class RefreshTokenRedisAdapter implements RefreshTokenPort {
    private static final String KEY_PREFIX = "auth:refresh-token:";

    private final StringRedisTemplate redisTemplate;
    private final Duration refreshTokenTtl;

    public RefreshTokenRedisAdapter(StringRedisTemplate redisTemplate,
            @Value("${jwt.refresh-token-expiration-seconds:604800}") long refreshTokenExpirationSeconds) {
        this.redisTemplate = redisTemplate;
        this.refreshTokenTtl = Duration.ofSeconds(refreshTokenExpirationSeconds);
    }

    @Override
    public void saveRefreshToken(String userId, String refreshToken) {
        redisTemplate.opsForValue().set(KEY_PREFIX + userId, refreshToken, refreshTokenTtl);
    }

    @Override
    public Optional<String> loadRefreshToken(String userId) {
        return Optional.ofNullable(redisTemplate.opsForValue().get(KEY_PREFIX + userId));
    }
}
