package me.unbrdn.core.auth.domain.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwsHeader;
import io.jsonwebtoken.JwtParser;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.SigningKeyResolverAdapter;
import java.security.Key;
import java.time.Duration;
import java.util.Date;
import me.unbrdn.core.auth.domain.service.JwtKeyProvider.JwtKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class JwtTokenProvider implements TokenProvider {
    private final Duration accessTokenTtl;
    private final Duration refreshTokenTtl;
    private final JwtKeyProvider keyProvider;
    private final JwtParser jwtParser;

    public JwtTokenProvider(
            JwtKeyProvider keyProvider,
            @Value("${jwt.access-token-expiration-seconds:1800}") long accessTokenExpirationSeconds,
            @Value("${jwt.refresh-token-expiration-seconds:2592000}")
                    long refreshTokenExpirationSeconds) {
        this.keyProvider = keyProvider;
        this.accessTokenTtl = Duration.ofSeconds(accessTokenExpirationSeconds);
        this.refreshTokenTtl = Duration.ofSeconds(refreshTokenExpirationSeconds);
        this.jwtParser =
                Jwts.parserBuilder()
                        .setSigningKeyResolver(new JwtSigningKeyResolver(keyProvider))
                        .build();
    }

    @Override
    public String generateAccessToken(String userId, String role) {
        Date now = new Date();
        Date expiresAt = new Date(now.getTime() + accessTokenTtl.toMillis());
        // Access token: 사용자 식별/권한을 담고 짧게 유지
        JwtKey activeKey = keyProvider.getActiveKey();
        return Jwts.builder()
                .setHeaderParam("kid", activeKey.getKid())
                .setSubject(userId)
                .setIssuedAt(now)
                .setExpiration(expiresAt)
                .claim("role", role)
                .claim("typ", "access")
                .signWith(activeKey.getPrivateKey(), SignatureAlgorithm.RS256)
                .compact();
    }

    @Override
    public String generateRefreshToken(String userId) {
        Date now = new Date();
        Date expiresAt = new Date(now.getTime() + refreshTokenTtl.toMillis());
        // Refresh token: 재발급용 식별 토큰, 상대적으로 길게 유지
        JwtKey activeKey = keyProvider.getActiveKey();
        return Jwts.builder()
                .setHeaderParam("kid", activeKey.getKid())
                .setSubject(userId)
                .setIssuedAt(now)
                .setExpiration(expiresAt)
                .claim("typ", "refresh")
                .signWith(activeKey.getPrivateKey(), SignatureAlgorithm.RS256)
                .compact();
    }

    @Override
    public String getUserIdFromRefreshToken(String refreshToken) {
        Claims claims = jwtParser.parseClaimsJws(refreshToken).getBody();
        String type = claims.get("typ", String.class);
        if (!"refresh".equals(type)) {
            throw new IllegalArgumentException("Invalid token type");
        }
        return claims.getSubject();
    }

    private static final class JwtSigningKeyResolver extends SigningKeyResolverAdapter {
        private final JwtKeyProvider keyProvider;

        private JwtSigningKeyResolver(JwtKeyProvider keyProvider) {
            this.keyProvider = keyProvider;
        }

        @Override
        public Key resolveSigningKey(JwsHeader header, Claims claims) {
            String kid = header.getKeyId();
            if (kid == null || kid.isBlank()) {
                throw new IllegalArgumentException("Missing key id.");
            }
            return keyProvider.getPublicKey(kid);
        }
    }
}
