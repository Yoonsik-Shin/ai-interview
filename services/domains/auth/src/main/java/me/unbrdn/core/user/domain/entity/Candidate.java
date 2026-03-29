package me.unbrdn.core.user.domain.entity;

import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.auth.domain.service.PasswordEncoder;
import me.unbrdn.core.user.domain.enums.AccountStatus;
import me.unbrdn.core.user.domain.enums.UserRole;

/** 면접자 엔티티 (User의 서브클래스) - Pure POJO */
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Candidate extends User {

    private CandidateOptions candidateOptions;

    /** OAuth 소셜 로그인으로 가입하는 팩토리 메서드 (비밀번호는 잠금 계정용 랜덤 해시) */
    public static Candidate createWithOAuth(
            String email,
            String nickname,
            String phoneNumber,
            String profileImageUrl,
            PasswordEncoder encoder) {
        Candidate candidate =
                Candidate.builder()
                        .email(email)
                        .password(encoder.encode(java.util.UUID.randomUUID().toString()))
                        .nickname(nickname)
                        .role(UserRole.CANDIDATE)
                        .phoneNumber(phoneNumber)
                        .profileImageUrl(profileImageUrl)
                        .isActive(AccountStatus.ACTIVE)
                        .build();
        candidate.candidateOptions = CandidateOptions.create(candidate);
        return candidate;
    }

    /** 비밀번호 해시화까지 책임지는 팩토리 메서드 */
    public static Candidate createWithRawPassword(
            String email,
            String rawPassword,
            String nickname,
            String phoneNumber,
            PasswordEncoder encoder) {
        Candidate candidate =
                Candidate.builder()
                        .email(email)
                        .password(encoder.encode(rawPassword))
                        .nickname(nickname)
                        .role(UserRole.CANDIDATE)
                        .phoneNumber(phoneNumber)
                        .isActive(AccountStatus.ACTIVE)
                        .build();
        candidate.candidateOptions = CandidateOptions.create(candidate);

        return candidate;
    }

    /** 면접자 개인설정 엔티티 - Pure POJO */
    @Getter
    @Setter
    @SuperBuilder
    @NoArgsConstructor(access = AccessLevel.PROTECTED)
    public static class CandidateOptions {

        private UUID id;
        private Candidate candidate;
        private Boolean isResumePublic;
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
