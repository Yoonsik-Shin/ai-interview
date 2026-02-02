package me.unbrdn.core.interview.application.port.out;

import java.util.Optional;
import java.util.UUID;
import me.unbrdn.core.user.domain.entity.User;

public interface LoadUserPort {
    Optional<User> loadById(UUID userId);
}
