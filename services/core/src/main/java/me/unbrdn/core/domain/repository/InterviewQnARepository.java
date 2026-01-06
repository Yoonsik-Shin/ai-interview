package me.unbrdn.core.domain.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import me.unbrdn.core.domain.entity.InterviewQnA;

public interface InterviewQnARepository extends JpaRepository<InterviewQnA, Long> {

  // 🔥 핵심 기능: 특정 면접의 모든 문답을 턴 순서대로 조회 (면접 진행 및 리플레이용)
  List<InterviewQnA> findByInterview_InterviewIdOrderByTurnNumberAsc(Long interviewId);

  // 특정 면접의 특정 턴 조회 (사용자 답변 저장 시 업데이트용)
  Optional<InterviewQnA> findByInterview_InterviewIdAndTurnNumber(Long interviewId, Integer turnNumber);
}