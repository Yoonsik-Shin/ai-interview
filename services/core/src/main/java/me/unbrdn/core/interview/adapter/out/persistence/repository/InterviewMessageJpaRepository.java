package me.unbrdn.core.interview.adapter.out.persistence.repository;

import java.util.UUID;
import me.unbrdn.core.interview.domain.entity.InterviewMessage;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InterviewMessageJpaRepository extends JpaRepository<InterviewMessage, UUID> {}
