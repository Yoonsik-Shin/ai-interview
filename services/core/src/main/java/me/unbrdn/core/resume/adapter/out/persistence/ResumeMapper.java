package me.unbrdn.core.resume.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.unbrdn.core.resume.adapter.out.persistence.entity.ResumeJpaEntity;
import me.unbrdn.core.resume.domain.entity.Resumes;
import me.unbrdn.core.user.adapter.out.persistence.UserMapper;
import me.unbrdn.core.user.domain.entity.User;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ResumeMapper {

    private final UserMapper userMapper;

    public Resumes toDomain(ResumeJpaEntity jpaEntity) {
        if (jpaEntity == null) return null;

        return Resumes.builder()
                .id(jpaEntity.getId())
                .user((User) userMapper.toDomain(jpaEntity.getUser()))
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
                .user(userMapper.toJpaEntity(domain.getUser()))
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
