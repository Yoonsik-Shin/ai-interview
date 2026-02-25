package me.unbrdn.core.auth.adapter.out.persistence;

import me.unbrdn.core.auth.domain.service.PasswordEncoder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

/** BCrypt를 사용한 PasswordEncoder 구현체 */
@Component
public class BcryptPasswordEncoder implements PasswordEncoder {

    private final BCryptPasswordEncoder passwordEncoder;

    public BcryptPasswordEncoder() {
        this.passwordEncoder = new BCryptPasswordEncoder();
    }

    @Override
    public String encode(String rawPassword) {
        return passwordEncoder.encode(rawPassword);
    }

    @Override
    public boolean matches(String rawPassword, String encodedPassword) {
        return passwordEncoder.matches(rawPassword, encodedPassword);
    }
}
