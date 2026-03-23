package me.unbrdn.core.user.adapter.out.persistence;

import me.unbrdn.core.user.adapter.out.persistence.entity.CandidateJpaEntity;
import me.unbrdn.core.user.adapter.out.persistence.entity.RecruiterJpaEntity;
import me.unbrdn.core.user.adapter.out.persistence.entity.UserJpaEntity;
import me.unbrdn.core.user.domain.entity.Candidate;
import me.unbrdn.core.user.domain.entity.Recruiter;
import me.unbrdn.core.user.domain.entity.User;
import org.springframework.stereotype.Component;

@Component
public class UserMapper {

    public User toDomain(UserJpaEntity jpaEntity) {
        if (jpaEntity == null) return null;

        if (jpaEntity instanceof CandidateJpaEntity candidateJpa) {
            return toCandidateDomain(candidateJpa);
        } else if (jpaEntity instanceof RecruiterJpaEntity recruiterJpa) {
            return toRecruiterDomain(recruiterJpa);
        }

        return User.builder()
                .id(jpaEntity.getId())
                .email(jpaEntity.getEmail())
                .password(jpaEntity.getPassword())
                .nickname(jpaEntity.getNickname())
                .role(jpaEntity.getRole())
                .isActive(jpaEntity.getIsActive())
                .phoneNumber(jpaEntity.getPhoneNumber())
                .verifiedEmail(jpaEntity.getVerifiedEmail())
                .profileImageUrl(jpaEntity.getProfileImageUrl())
                .deletedAt(jpaEntity.getDeletedAt())
                .lastLoginedAt(jpaEntity.getLastLoginedAt())
                .createdAt(jpaEntity.getCreatedAt())
                .updatedAt(jpaEntity.getUpdatedAt())
                .build();
    }

    public Candidate toCandidateDomain(CandidateJpaEntity jpaEntity) {
        Candidate candidate =
                Candidate.builder()
                        .id(jpaEntity.getId())
                        .email(jpaEntity.getEmail())
                        .password(jpaEntity.getPassword())
                        .nickname(jpaEntity.getNickname())
                        .role(jpaEntity.getRole())
                        .isActive(jpaEntity.getIsActive())
                        .phoneNumber(jpaEntity.getPhoneNumber())
                        .verifiedEmail(jpaEntity.getVerifiedEmail())
                        .profileImageUrl(jpaEntity.getProfileImageUrl())
                        .deletedAt(jpaEntity.getDeletedAt())
                        .lastLoginedAt(jpaEntity.getLastLoginedAt())
                        .createdAt(jpaEntity.getCreatedAt())
                        .updatedAt(jpaEntity.getUpdatedAt())
                        .build();

        if (jpaEntity.getCandidateOptions() != null) {
            candidate.setCandidateOptions(
                    Candidate.CandidateOptions.builder()
                            .id(jpaEntity.getCandidateOptions().getId())
                            .isResumePublic(jpaEntity.getCandidateOptions().getIsResumePublic())
                            .isInterviewPublic(
                                    jpaEntity.getCandidateOptions().getIsInterviewPublic())
                            .build());
        }
        return candidate;
    }

    public Recruiter toRecruiterDomain(RecruiterJpaEntity jpaEntity) {
        return Recruiter.builder()
                .id(jpaEntity.getId())
                .email(jpaEntity.getEmail())
                .password(jpaEntity.getPassword())
                .nickname(jpaEntity.getNickname())
                .role(jpaEntity.getRole())
                .isActive(jpaEntity.getIsActive())
                .phoneNumber(jpaEntity.getPhoneNumber())
                .verifiedEmail(jpaEntity.getVerifiedEmail())
                .profileImageUrl(jpaEntity.getProfileImageUrl())
                .deletedAt(jpaEntity.getDeletedAt())
                .lastLoginedAt(jpaEntity.getLastLoginedAt())
                .createdAt(jpaEntity.getCreatedAt())
                .updatedAt(jpaEntity.getUpdatedAt())
                .companyCode(jpaEntity.getCompanyCode())
                .build();
    }

    public UserJpaEntity toJpaEntity(User domain) {
        if (domain == null) return null;

        if (domain instanceof Candidate candidate) {
            return toCandidateJpaEntity(candidate);
        } else if (domain instanceof Recruiter recruiter) {
            return toRecruiterJpaEntity(recruiter);
        }

        return UserJpaEntity.builder()
                .id(domain.getId())
                .email(domain.getEmail())
                .password(domain.getPassword())
                .nickname(domain.getNickname())
                .role(domain.getRole())
                .isActive(domain.getIsActive())
                .phoneNumber(domain.getPhoneNumber())
                .verifiedEmail(domain.getVerifiedEmail())
                .profileImageUrl(domain.getProfileImageUrl())
                .deletedAt(domain.getDeletedAt())
                .lastLoginedAt(domain.getLastLoginedAt())
                .build();
    }

    public CandidateJpaEntity toCandidateJpaEntity(Candidate domain) {
        CandidateJpaEntity jpaEntity =
                CandidateJpaEntity.builder()
                        .id(domain.getId())
                        .email(domain.getEmail())
                        .password(domain.getPassword())
                        .nickname(domain.getNickname())
                        .role(domain.getRole())
                        .isActive(domain.getIsActive())
                        .phoneNumber(domain.getPhoneNumber())
                        .verifiedEmail(domain.getVerifiedEmail())
                        .profileImageUrl(domain.getProfileImageUrl())
                        .deletedAt(domain.getDeletedAt())
                        .lastLoginedAt(domain.getLastLoginedAt())
                        .build();

        if (domain.getCandidateOptions() != null) {
            // Options mapping would go here
        }
        return jpaEntity;
    }

    public RecruiterJpaEntity toRecruiterJpaEntity(Recruiter domain) {
        return RecruiterJpaEntity.builder()
                .id(domain.getId())
                .email(domain.getEmail())
                .password(domain.getPassword())
                .nickname(domain.getNickname())
                .role(domain.getRole())
                .isActive(domain.getIsActive())
                .phoneNumber(domain.getPhoneNumber())
                .verifiedEmail(domain.getVerifiedEmail())
                .profileImageUrl(domain.getProfileImageUrl())
                .deletedAt(domain.getDeletedAt())
                .lastLoginedAt(domain.getLastLoginedAt())
                .companyCode(domain.getCompanyCode())
                .build();
    }
}
