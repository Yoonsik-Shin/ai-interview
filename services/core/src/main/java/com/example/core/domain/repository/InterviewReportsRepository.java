package com.example.core.domain.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.core.domain.entity.InterviewReports;

public interface InterviewReportsRepository extends JpaRepository<InterviewReports, Long> {

  // 면접 ID로 리포트 조회 (1:1 관계이므로 결과는 Optional)
  Optional<InterviewReports> findByInterview_InterviewId(Long interviewId);
}