package me.unbrdn.core.resume.adapter.out.persistence;

import me.unbrdn.core.resume.adapter.out.persistence.entity.ResumeJpaEntity;
import me.unbrdn.core.resume.domain.entity.Resumes;
import org.springframework.stereotype.Component;

@Component
public class ResumeMapper {

    public Resumes toDomain(ResumeJpaEntity jpaEntity) {
        if (jpaEntity == null) return null;

        return Resumes.builder()
                .id(jpaEntity.getId())
                .userId(jpaEntity.getUserId())
                .title(jpaEntity.getTitle())
                .content(jpaEntity.getContent())
                .fileHash(jpaEntity.getFileHash())
                .filePath(jpaEntity.getFilePath())
                .status(jpaEntity.getStatus())
                .imageUrls(jpaEntity.getImageUrls())
                .vectorStatus(jpaEntity.getVectorStatus())
                .createdAt(jpaEntity.getCreatedAt())
                .updatedAt(jpaEntity.getUpdatedAt())
                .build();
    }

    public ResumeJpaEntity toJpaEntity(Resumes domain) {
        if (domain == null) return null;

        return ResumeJpaEntity.builder()
                .id(domain.getId())
                .userId(domain.getUserId())
                .title(domain.getTitle())
                .content(domain.getContent())
                .fileHash(domain.getFileHash())
                .filePath(domain.getFilePath())
                .status(domain.getStatus())
                .imageUrls(domain.getImageUrls())
                .vectorStatus(domain.getVectorStatus())
                .build();
    }
}
