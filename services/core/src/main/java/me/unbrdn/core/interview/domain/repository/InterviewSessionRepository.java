package me.unbrdn.core.interview.domain.repository;

import java.util.List;
import java.util.UUID;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InterviewSessionRepository extends JpaRepository<InterviewSession, UUID> {
    // 특정 사용자의 면접 내역 조회 (최신순 정렬)
    // Candidate ID를 사용하여 조회
    List<InterviewSession> findByCandidate_IdOrderByStartedAtDesc(UUID candidateId);
}
