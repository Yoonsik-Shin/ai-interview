package me.unbrdn.core.auth.domain.service;

/**
 * 비밀번호 인코딩 및 검증을 위한 도메인 서비스 인터페이스
 * 
 * Hexagonal Architecture 원칙에 따라 도메인 계층에서 외부 기술(BCrypt 등)에 의존하지 않도록
 * 인터페이스로 추상화합니다.
 */
public interface PasswordEncoder {

  /**
   * 평문 비밀번호를 해시로 인코딩합니다.
   * 
   * @param rawPassword 평문 비밀번호
   * @return 해시된 비밀번호
   */
  String encode(String rawPassword);

  /**
   * 평문 비밀번호와 해시된 비밀번호가 일치하는지 검증합니다.
   * 
   * @param rawPassword 평문 비밀번호
   * @param encodedPassword 해시된 비밀번호
   * @return 일치 여부
   */
  boolean matches(String rawPassword, String encodedPassword);
}

