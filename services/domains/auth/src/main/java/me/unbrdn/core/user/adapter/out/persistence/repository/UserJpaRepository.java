package me.unbrdn.core.user.adapter.out.persistence.repository;

import java.util.Optional;
import java.util.UUID;
import me.unbrdn.core.user.adapter.out.persistence.entity.UserJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserJpaRepository extends JpaRepository<UserJpaEntity, UUID> {
    Optional<UserJpaEntity> findByEmail(String email);

    Optional<UserJpaEntity> findByNickname(String nickname);
}
