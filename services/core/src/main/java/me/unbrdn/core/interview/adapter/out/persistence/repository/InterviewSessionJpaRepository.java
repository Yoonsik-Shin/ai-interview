package me.unbrdn.core.interview.adapter.out.persistence.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import me.unbrdn.core.interview.adapter.out.persistence.entity.InterviewSessionJpaEntity;
import me.unbrdn.core.interview.domain.enums.InterviewSessionStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface InterviewSessionJpaRepository
        extends JpaRepository<InterviewSessionJpaEntity, UUID> {
    Optional<InterviewSessionJpaEntity> findByInterviewId(String interviewId);

    // 특정 사용자의 면접 내역 조회 (최신순 정렬)
    @EntityGraph(attributePaths = {"candidate", "resume"})
    List<InterviewSessionJpaEntity> findByCandidate_IdOrderByStartedAtDesc(UUID candidateId);

    // 상태 필터링 및 페이징 지원
    @EntityGraph(attributePaths = {"candidate", "resume"})
    List<InterviewSessionJpaEntity> findByCandidate_IdAndStatusInOrderByStartedAtDesc(
            UUID candidateId, List<InterviewSessionStatus> statuses, Pageable pageable);
}
