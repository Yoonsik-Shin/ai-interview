package me.unbrdn.core.resume.application.port.out;

import java.util.Optional;

import me.unbrdn.core.domain.entity.Users;

/**
 * 사용자 조회 Output Port (Resume 모듈용)
 */
public interface LoadUserPort {

  Optional<Users> loadById(Long userId);
}

