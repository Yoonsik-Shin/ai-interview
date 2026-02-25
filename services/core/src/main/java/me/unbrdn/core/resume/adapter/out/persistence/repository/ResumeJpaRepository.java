package me.unbrdn.core.resume.adapter.out.persistence.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import me.unbrdn.core.resume.adapter.out.persistence.entity.ResumeJpaEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ResumeJpaRepository extends JpaRepository<ResumeJpaEntity, UUID> {
    @EntityGraph(attributePaths = {"user"})
    List<ResumeJpaEntity> findByUserId(UUID userId);

    Optional<ResumeJpaEntity> findByFileHash(String fileHash);
}
