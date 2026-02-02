package me.unbrdn.core.auth.domain.service;

import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import me.unbrdn.core.auth.config.JwtKeyProperties;
import org.springframework.stereotype.Component;

@Component
public class JwtKeyProvider {
    private final Map<String, JwtKey> keysById;
    private final JwtKey activeKey;

    public JwtKeyProvider(JwtKeyProperties properties) {
        List<JwtKeyProperties.KeyEntry> entries =
                properties.getKeys() == null ? Collections.emptyList() : properties.getKeys();
        if (entries.isEmpty()) {
            throw new IllegalStateException("JWT keys are not configured.");
        }

        Map<String, JwtKey> keyMap = new HashMap<>();
        JwtKey active = null;
        for (JwtKeyProperties.KeyEntry entry : entries) {
            String kid = entry.getKid();
            if (kid == null || kid.trim().isEmpty()) {
                continue;
            }
            if (keyMap.containsKey(kid)) {
                throw new IllegalStateException("Duplicate JWT key id: " + kid);
            }

            PublicKey publicKey = parsePublicKey(entry.getPublicKey());
            PrivateKey privateKey = null;
            if (entry.isActive()) {
                if (entry.getPrivateKey() == null || entry.getPrivateKey().trim().isEmpty()) {
                    throw new IllegalStateException("Active JWT key requires private key: " + kid);
                }
                privateKey = parsePrivateKey(entry.getPrivateKey());
            }

            JwtKey jwtKey = new JwtKey(kid, privateKey, publicKey, entry.isActive());
            keyMap.put(kid, jwtKey);

            if (entry.isActive()) {
                if (active != null) {
                    throw new IllegalStateException("Multiple active JWT keys configured.");
                }
                active = jwtKey;
            }
        }

        if (keyMap.isEmpty()) {
            throw new IllegalStateException("JWT keys are not configured.");
        }
        if (active == null) {
            throw new IllegalStateException("Active JWT key is required.");
        }

        this.keysById = Collections.unmodifiableMap(keyMap);
        this.activeKey = active;
    }

    public JwtKey getActiveKey() {
        return activeKey;
    }

    public PublicKey getPublicKey(String kid) {
        JwtKey key = keysById.get(kid);
        if (key == null) {
            throw new IllegalArgumentException("Unknown JWT key id: " + kid);
        }
        return key.getPublicKey();
    }

    public Map<String, JwtKey> getKeysById() {
        return keysById;
    }

    private static PrivateKey parsePrivateKey(String privateKeyValue) {
        byte[] keyBytes = decodeKeyBytes(privateKeyValue);
        try {
            KeyFactory keyFactory = KeyFactory.getInstance("RSA");
            return keyFactory.generatePrivate(new PKCS8EncodedKeySpec(keyBytes));
        } catch (Exception ex) {
            throw new IllegalStateException("Invalid RSA private key.", ex);
        }
    }

    private static PublicKey parsePublicKey(String publicKeyValue) {
        byte[] keyBytes = decodeKeyBytes(publicKeyValue);
        try {
            KeyFactory keyFactory = KeyFactory.getInstance("RSA");
            return keyFactory.generatePublic(new X509EncodedKeySpec(keyBytes));
        } catch (Exception ex) {
            throw new IllegalStateException("Invalid RSA public key.", ex);
        }
    }

    private static byte[] decodeKeyBytes(String keyValue) {
        if (keyValue == null || keyValue.trim().isEmpty()) {
            throw new IllegalStateException("JWT key value is required.");
        }
        String normalized = keyValue.replace("\\n", "\n").trim();
        normalized =
                normalized
                        .replace("-----BEGIN PRIVATE KEY-----", "")
                        .replace("-----END PRIVATE KEY-----", "")
                        .replace("-----BEGIN RSA PRIVATE KEY-----", "")
                        .replace("-----END RSA PRIVATE KEY-----", "")
                        .replace("-----BEGIN PUBLIC KEY-----", "")
                        .replace("-----END PUBLIC KEY-----", "")
                        .replaceAll("\\s", "");
        try {
            return Base64.getDecoder().decode(normalized);
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("Invalid base64 key value.", ex);
        }
    }

    @Getter
    public static class JwtKey {
        private final String kid;
        private final PrivateKey privateKey;
        private final PublicKey publicKey;
        private final boolean active;

        public JwtKey(String kid, PrivateKey privateKey, PublicKey publicKey, boolean active) {
            this.kid = kid;
            this.privateKey = privateKey;
            this.publicKey = publicKey;
            this.active = active;
        }
    }
}
