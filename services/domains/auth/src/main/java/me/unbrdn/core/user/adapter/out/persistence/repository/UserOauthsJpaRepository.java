package me.unbrdn.core.user.adapter.out.persistence.repository;

import java.util.Optional;
import java.util.UUID;
import me.unbrdn.core.user.adapter.out.persistence.entity.UserOauthsJpaEntity;
import me.unbrdn.core.user.adapter.out.persistence.entity.UserOauthsJpaEntity.UserOauthsId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserOauthsJpaRepository extends JpaRepository<UserOauthsJpaEntity, UserOauthsId> {

    Optional<UserOauthsJpaEntity> findByProviderIdAndProviderUserId(
            UUID providerId, String providerUserId);
}
