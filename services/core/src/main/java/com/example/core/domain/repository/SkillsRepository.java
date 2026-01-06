package com.example.core.domain.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.core.domain.entity.Skills;

public interface SkillsRepository extends JpaRepository<Skills, Long> {
  // 기술 이름으로 조회 (중복 방지 및 검색용)
  Optional<Skills> findByName(String name);
}