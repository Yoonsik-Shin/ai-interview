package me.unbrdn.core.resume.domain.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import me.unbrdn.core.user.domain.entity.UserSkills;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserSkillsRepository extends JpaRepository<UserSkills, UUID> {

    // 특정 사용자가 가진 모든 기술 스택 목록 조회
    List<UserSkills> findByUser_Id(UUID userId);

    // 🔥 비식별 관계에서 특정 유저-스킬 조합을 찾기 위한 메서드
    // (예: 이미 등록된 스킬인지 체크하거나 숙련도를 업데이트할 때 사용)
    Optional<UserSkills> findByUser_IdAndSkill_Id(UUID userId, UUID skillId);
}
