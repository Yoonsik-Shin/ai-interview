package me.unbrdn.core.interview.domain.repository;

import java.util.UUID;
import me.unbrdn.core.interview.domain.entity.InterviewHistory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InterviewHistoryRepository extends JpaRepository<InterviewHistory, UUID> {}
