package me.unbrdn.core.user.application.port.out;

import java.util.Optional;
import java.util.UUID;
import me.unbrdn.core.user.domain.entity.User;

public interface UserPort {

    /**
     * 사용자를 저장합니다.
     *
     * @param user 저장할 사용자
     * @return 저장된 사용자
     */
    User save(User user);

    /**
     * 이메일로 사용자를 조회합니다.
     *
     * @param email 이메일
     * @return 사용자 (없으면 Optional.empty())
     */
    Optional<User> loadByEmail(String email);

    /**
     * ID로 사용자를 조회합니다.
     *
     * @param userId 사용자 ID (UUID)
     * @return 사용자 (없으면 Optional.empty())
     */
    Optional<User> loadById(UUID userId);
}
