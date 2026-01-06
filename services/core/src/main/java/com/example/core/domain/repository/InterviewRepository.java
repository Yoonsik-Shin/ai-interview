package com.example.core.domain.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.core.domain.entity.Interviews;

public interface InterviewRepository extends JpaRepository<Interviews, Long> {
  // 특정 사용자의 면접 내역 조회 (최신순 정렬)
  List<Interviews> findByUser_UserIdOrderByStartedAtDesc(Long userId);
}