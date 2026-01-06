package com.example.core.domain.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.core.domain.entity.Resumes;

public interface ResumesRepository extends JpaRepository<Resumes, Long> {
  // 특정 사용자의 모든 이력서 조회
  List<Resumes> findByUser_UserId(Long userId);
}