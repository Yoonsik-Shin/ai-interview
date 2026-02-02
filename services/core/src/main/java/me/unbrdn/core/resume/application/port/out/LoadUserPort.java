package me.unbrdn.core.resume.application.port.out;

import java.util.Optional;
import java.util.UUID;
import me.unbrdn.core.user.domain.entity.User;

/** 사용자 조회 Output Port (Resume 모듈용) */
public interface LoadUserPort {

    Optional<User> loadById(UUID userId);
}
