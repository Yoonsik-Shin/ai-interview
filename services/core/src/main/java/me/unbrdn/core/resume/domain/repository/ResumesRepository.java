package me.unbrdn.core.resume.domain.repository;

import java.util.List;
import java.util.UUID;
import me.unbrdn.core.resume.domain.entity.Resumes;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ResumesRepository extends JpaRepository<Resumes, UUID> {
    // 특정 사용자의 모든 이력서 조회
    List<Resumes> findByUser_Id(UUID userId);
}
