package me.unbrdn.core.resume.domain.repository;

import java.util.Optional;
import java.util.UUID;
import me.unbrdn.core.reference.domain.Skills;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SkillsRepository extends JpaRepository<Skills, UUID> {
    // 기술 이름으로 조회 (중복 방지 및 검색용)
    Optional<Skills> findByName(String name);
}
