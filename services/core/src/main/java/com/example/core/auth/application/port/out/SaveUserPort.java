package com.example.core.auth.application.port.out;

import com.example.core.domain.entity.Users;

/**
 * 사용자 저장 Output Port
 * 
 * Application Layer에서 Persistence Layer로 요청하는 인터페이스
 */
public interface SaveUserPort {

  /**
   * 사용자를 저장합니다.
   * 
   * @param user 저장할 사용자
   * @return 저장된 사용자
   */
  Users save(Users user);
}

