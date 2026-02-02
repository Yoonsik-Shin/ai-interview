package me.unbrdn.core.user.domain.entity;

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
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.auth.domain.service.PasswordEncoder;
import me.unbrdn.core.user.domain.enums.AccountStatus;
import me.unbrdn.core.user.domain.enums.UserRole;

/**
 * 면접자 엔티티 (User의 서브클래스)
 *
 * <p>// TODO: 구현필요
 *
 * <p>관련 엔티티: - CandidateSkill: 면접자가 보유한 기술 스택 - CandidateDesireJobField: 면접자가 희망하는 직무 분야 - Resume:
 * 면접자의 이력서 - Career: 면접자의 경력 - InterviewSession: 면접자가 참여한 면접 세션
 */
@Entity
@DiscriminatorValue("CANDIDATE")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Candidate extends User {

    @OneToOne(mappedBy = "candidate", cascade = CascadeType.ALL, orphanRemoval = true)
    private CandidateOptions candidateOptions;

    @Builder(builderMethodName = "candidateBuilder", access = AccessLevel.PRIVATE)
    private Candidate(String email, String password, String nickname, String phoneNumber) {
        super(email, password, nickname, UserRole.CANDIDATE, phoneNumber, AccountStatus.ACTIVE);
    }

    /** 비밀번호 해시화까지 책임지는 팩토리 메서드 */
    public static Candidate createWithRawPassword(
            String email,
            String rawPassword,
            String nickname,
            String phoneNumber,
            PasswordEncoder encoder) {
        Candidate candidate =
                Candidate.candidateBuilder()
                        .email(email)
                        .password(encoder.encode(rawPassword))
                        .nickname(nickname)
                        .phoneNumber(phoneNumber)
                        .build();
        candidate.candidateOptions = CandidateOptions.create(candidate);

        return candidate;
    }

    /** 면접자 개인설정 엔티티 */
    @Entity
    @Table(name = "candidate_options")
    @Getter
    @NoArgsConstructor(access = AccessLevel.PROTECTED)
    public static class CandidateOptions {

        @Id
        @Column(name = "id", columnDefinition = "uuid", updatable = false, nullable = false)
        private UUID id;

        @MapsId
        @OneToOne(fetch = FetchType.LAZY, optional = false)
        @JoinColumn(name = "id", nullable = false)
        private Candidate candidate;

        @Column(name = "is_resume_public", nullable = false)
        private Boolean isResumePublic;

        @Column(name = "is_interview_public", nullable = false)
        private Boolean isInterviewPublic;

        private CandidateOptions(Candidate candidate) {
            this.candidate = candidate;
            this.isResumePublic = false;
            this.isInterviewPublic = false;
        }

        /** 면접자 옵션 생성 (기본값: 모두 비공개) */
        static CandidateOptions create(Candidate candidate) {
            return new CandidateOptions(candidate);
        }

        /** 이력서 공개 설정 변경 */
        public void updateResumePublic(Boolean isPublic) {
            this.isResumePublic = isPublic;
        }

        /** 이력서 비공개 설정 */
        public void updateResumePrivate() {
            this.isResumePublic = false;
        }

        /** 면접 공개 설정 변경 */
        public void updateInterviewPublic(Boolean isPublic) {
            this.isInterviewPublic = isPublic;
        }

        /** 면접 비공개 설정 */
        public void updateInterviewPrivate() {
            this.isInterviewPublic = false;
        }
    }
}
