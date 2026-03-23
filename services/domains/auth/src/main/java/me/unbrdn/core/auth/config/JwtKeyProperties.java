package me.unbrdn.core.auth.config;

import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "jwt")
public class JwtKeyProperties {
    private List<KeyEntry> keys = new ArrayList<>();

    @Getter
    @Setter
    public static class KeyEntry {
        private String kid;
        private String privateKey;
        private String publicKey;
        private boolean active;
    }
}
