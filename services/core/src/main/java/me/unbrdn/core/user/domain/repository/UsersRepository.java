package me.unbrdn.core.user.domain.repository;

import java.util.Optional;
import java.util.UUID;
import me.unbrdn.core.user.domain.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UsersRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
}
