package me.unbrdn.core.auth.domain.service;

import java.math.BigInteger;
import java.security.interfaces.RSAPublicKey;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.auth.domain.service.JwtKeyProvider.JwtKey;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class JwtJwksProvider {
    private final JwtKeyProvider keyProvider;

    public Map<String, Object> getJwks() {
        List<Map<String, String>> keys =
                keyProvider.getKeysById().values().stream()
                        .map(this::toJwk)
                        .collect(Collectors.toList());
        Map<String, Object> jwks = new LinkedHashMap<>();
        jwks.put("keys", keys);
        return jwks;
    }

    private Map<String, String> toJwk(JwtKey key) {
        if (!(key.getPublicKey() instanceof RSAPublicKey)) {
            throw new IllegalStateException("JWT public key is not RSA.");
        }
        RSAPublicKey publicKey = (RSAPublicKey) key.getPublicKey();
        Map<String, String> jwk = new LinkedHashMap<>();
        jwk.put("kty", "RSA");
        jwk.put("kid", key.getKid());
        jwk.put("use", "sig");
        jwk.put("alg", "RS256");
        jwk.put("n", base64Url(publicKey.getModulus()));
        jwk.put("e", base64Url(publicKey.getPublicExponent()));
        return jwk;
    }

    private static String base64Url(BigInteger value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(toUnsignedBytes(value));
    }

    private static byte[] toUnsignedBytes(BigInteger value) {
        byte[] bytes = value.toByteArray();
        if (bytes.length > 1 && bytes[0] == 0) {
            byte[] trimmed = new byte[bytes.length - 1];
            System.arraycopy(bytes, 1, trimmed, 0, trimmed.length);
            return trimmed;
        }
        return bytes;
    }
}
