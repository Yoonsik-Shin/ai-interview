package me.unbrdn.core.interview.adapter.out.persistence.repository;

import java.util.UUID;
import me.unbrdn.core.interview.adapter.out.persistence.entity.InterviewAdjustmentLogJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface InterviewAdjustmentLogJpaRepository
        extends JpaRepository<InterviewAdjustmentLogJpaEntity, UUID> {}
