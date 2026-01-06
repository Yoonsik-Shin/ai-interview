package com.example.core.domain.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.core.domain.entity.UserSkills;

public interface UserSkillsRepository extends JpaRepository<UserSkills, Long> {

  // 특정 사용자가 가진 모든 기술 스택 목록 조회
  List<UserSkills> findByUser_UserId(Long userId);

  // 🔥 비식별 관계에서 특정 유저-스킬 조합을 찾기 위한 메서드
  // (예: 이미 등록된 스킬인지 체크하거나 숙련도를 업데이트할 때 사용)
  Optional<UserSkills> findByUser_UserIdAndSkill_SkillId(Long userId, Long skillId);
}