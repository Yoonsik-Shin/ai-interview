package me.unbrdn.core.user.adapter.out.persistence.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Entity
@DiscriminatorValue("CANDIDATE")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CandidateJpaEntity extends UserJpaEntity {

    @OneToOne(mappedBy = "candidate", cascade = CascadeType.ALL, orphanRemoval = true)
    private CandidateOptionsJpaEntity candidateOptions;

    @Entity
    @Table(name = "candidate_options")
    @Getter
    @SuperBuilder
    @NoArgsConstructor(access = AccessLevel.PROTECTED)
    public static class CandidateOptionsJpaEntity {
        @Id
        @Column(name = "id", columnDefinition = "uuid", updatable = false, nullable = false)
        private UUID id;

        @MapsId
        @OneToOne(fetch = FetchType.LAZY, optional = false)
        @JoinColumn(name = "id", nullable = false)
        private CandidateJpaEntity candidate;

        @Column(name = "is_resume_public", nullable = false)
        private Boolean isResumePublic;

        @Column(name = "is_interview_public", nullable = false)
        private Boolean isInterviewPublic;
    }
}
