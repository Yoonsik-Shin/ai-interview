package me.unbrdn.core.auth.adapter.out.persistence;

import me.unbrdn.core.auth.domain.service.PasswordEncoder;
import org.springframework.stereotype.Component;

/** BCrypt를 사용한 PasswordEncoder 구현체 */
@Component
public class BcryptPasswordEncoder implements PasswordEncoder {

    private final org.springframework.security.crypto.password.PasswordEncoder
            springPasswordEncoder;

    public BcryptPasswordEncoder() {
        this.springPasswordEncoder =
                new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder();
    }

    @Override
    public String encode(String rawPassword) {
        return springPasswordEncoder.encode(rawPassword);
    }

    @Override
    public boolean matches(String rawPassword, String encodedPassword) {
        return springPasswordEncoder.matches(rawPassword, encodedPassword);
    }
}
