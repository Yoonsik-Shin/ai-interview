package me.unbrdn.core.interview.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.adapter.out.persistence.entity.InterviewAdjustmentLogJpaEntity;
import me.unbrdn.core.interview.adapter.out.persistence.entity.InterviewReportsJpaEntity;
import me.unbrdn.core.interview.adapter.out.persistence.entity.InterviewSessionJpaEntity;
import me.unbrdn.core.interview.domain.entity.InterviewAdjustmentLog;
import me.unbrdn.core.interview.domain.entity.InterviewReports;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import me.unbrdn.core.resume.adapter.out.persistence.ResumeMapper;
import me.unbrdn.core.user.adapter.out.persistence.UserMapper;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class InterviewMapper {

    private final UserMapper userMapper;
    private final ResumeMapper resumeMapper;

    public InterviewSession toDomain(InterviewSessionJpaEntity jpaEntity) {
        if (jpaEntity == null) return null;

        return InterviewSession.builder()
                .id(jpaEntity.getId())
                .candidate(userMapper.toCandidateDomain(jpaEntity.getCandidate()))
                .resume(resumeMapper.toDomain(jpaEntity.getResume()))
                .personality(jpaEntity.getPersonality())
                .type(jpaEntity.getType())
                .status(jpaEntity.getStatus())
                .startedAt(jpaEntity.getStartedAt())
                .endedAt(jpaEntity.getEndedAt())
                .domain(jpaEntity.getDomain())
                .initialTargetDurationMinutes(jpaEntity.getInitialTargetDurationMinutes())
                .targetDurationMinutes(jpaEntity.getTargetDurationMinutes())
                .selfIntroduction(jpaEntity.getSelfIntroduction())
                .turnCount(jpaEntity.getTurnCount())
                .version(jpaEntity.getVersion())
                .createdAt(jpaEntity.getCreatedAt())
                .updatedAt(jpaEntity.getUpdatedAt())
                .build();
    }

    public InterviewSessionJpaEntity toJpaEntity(InterviewSession domain) {
        if (domain == null) return null;

        return InterviewSessionJpaEntity.builder()
                .id(domain.getId())
                .interviewId(domain.getId().toString())
                .candidate(userMapper.toCandidateJpaEntity(domain.getCandidate()))
                .resume(resumeMapper.toJpaEntity(domain.getResume()))
                .personality(domain.getPersonality())
                .type(domain.getType())
                .status(domain.getStatus())
                .startedAt(domain.getStartedAt())
                .endedAt(domain.getEndedAt())
                .domain(domain.getDomain())
                .initialTargetDurationMinutes(domain.getInitialTargetDurationMinutes())
                .targetDurationMinutes(domain.getTargetDurationMinutes())
                .selfIntroduction(domain.getSelfIntroduction())
                .turnCount(domain.getTurnCount())
                .version(domain.getVersion())
                .createdAt(domain.getCreatedAt())
                .updatedAt(domain.getUpdatedAt())
                .build();
    }

    public InterviewReports toDomain(InterviewReportsJpaEntity jpaEntity) {
        if (jpaEntity == null) return null;

        return InterviewReports.builder()
                .id(jpaEntity.getId())
                .interview(toDomain(jpaEntity.getInterview()))
                .totalScore(jpaEntity.getTotalScore())
                .passFailStatus(jpaEntity.getPassFailStatus())
                .summaryText(jpaEntity.getSummaryText())
                .resumeFeedback(jpaEntity.getResumeFeedback())
                .detailMetrics(jpaEntity.getDetailMetrics())
                .createdAt(jpaEntity.getCreatedAt())
                .updatedAt(jpaEntity.getUpdatedAt())
                .build();
    }

    public InterviewReportsJpaEntity toJpaEntity(InterviewReports domain) {
        if (domain == null) return null;

        return InterviewReportsJpaEntity.builder()
                .id(domain.getId())
                .interview(toJpaEntity(domain.getInterview()))
                .totalScore(domain.getTotalScore())
                .passFailStatus(domain.getPassFailStatus())
                .summaryText(domain.getSummaryText())
                .resumeFeedback(domain.getResumeFeedback())
                .detailMetrics(domain.getDetailMetrics())
                .createdAt(domain.getCreatedAt())
                .updatedAt(domain.getUpdatedAt())
                .build();
    }

    public InterviewAdjustmentLogJpaEntity toJpaEntity(InterviewAdjustmentLog domain) {
        if (domain == null) return null;

        return InterviewAdjustmentLogJpaEntity.builder()
                .id(domain.getId())
                .interviewId(domain.getInterviewId())
                .adjustmentType(domain.getAdjustmentType())
                .oldValue(domain.getOldValue())
                .newValue(domain.getNewValue())
                .reason(domain.getReason())
                .createdAt(domain.getCreatedAt())
                .build();
    }
}
