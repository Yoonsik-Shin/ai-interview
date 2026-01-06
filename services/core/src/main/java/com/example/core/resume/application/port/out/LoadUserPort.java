package com.example.core.resume.application.port.out;

import java.util.Optional;

import com.example.core.domain.entity.Users;

/**
 * 사용자 조회 Output Port (Resume 모듈용)
 */
public interface LoadUserPort {

  Optional<Users> loadById(Long userId);
}

