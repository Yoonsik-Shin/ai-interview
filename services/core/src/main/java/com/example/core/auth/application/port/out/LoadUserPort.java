package com.example.core.auth.application.port.out;

import java.util.Optional;

import com.example.core.domain.entity.Users;

/**
 * 사용자 조회 Output Port
 * 
 * Application Layer에서 Persistence Layer로 요청하는 인터페이스
 */
public interface LoadUserPort {

  /**
   * 이메일로 사용자를 조회합니다.
   * 
   * @param email 이메일
   * @return 사용자 (없으면 Optional.empty())
   */
  Optional<Users> loadByEmail(String email);

  /**
   * ID로 사용자를 조회합니다.
   * 
   * @param userId 사용자 ID
   * @return 사용자 (없으면 Optional.empty())
   */
  Optional<Users> loadById(Long userId);
}

