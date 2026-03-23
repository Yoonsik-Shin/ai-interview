package me.unbrdn.core.interview.adapter.out.persistence.repository;

import java.util.UUID;
import me.unbrdn.core.interview.adapter.out.persistence.entity.InterviewStateSnapshotJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InterviewStateSnapshotRepository
        extends JpaRepository<InterviewStateSnapshotJpaEntity, UUID> {}
