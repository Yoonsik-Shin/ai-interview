package me.unbrdn.core.interview.domain.repository;

import me.unbrdn.core.interview.domain.entity.InterviewResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface InterviewResultRepository extends JpaRepository<InterviewResult, Long> {
    // 추가 쿼리 메서드는 필요시 정의
}
