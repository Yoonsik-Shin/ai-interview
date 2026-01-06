package com.example.core.auth.adapter.out.persistence;

import org.springframework.stereotype.Component;

import com.example.core.auth.domain.service.PasswordEncoder;

/**
 * BCrypt를 사용한 PasswordEncoder 구현체
 * 
 * Adapter 계층에서 외부 라이브러리(Spring Security)를 사용하여 도메인 인터페이스를 구현합니다.
 */
@Component
public class BcryptPasswordEncoder implements PasswordEncoder {

  private final org.springframework.security.crypto.password.PasswordEncoder springPasswordEncoder;

  public BcryptPasswordEncoder() {
    this.springPasswordEncoder = new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder();
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
