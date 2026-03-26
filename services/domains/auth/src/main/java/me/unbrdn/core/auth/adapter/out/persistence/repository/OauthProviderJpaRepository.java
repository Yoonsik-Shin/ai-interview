package me.unbrdn.core.auth.adapter.out.persistence.repository;

import java.util.Optional;
import java.util.UUID;
import me.unbrdn.core.auth.adapter.out.persistence.entity.OauthProviderJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OauthProviderJpaRepository extends JpaRepository<OauthProviderJpaEntity, UUID> {

    Optional<OauthProviderJpaEntity> findByCompanyName(String companyName);
}
