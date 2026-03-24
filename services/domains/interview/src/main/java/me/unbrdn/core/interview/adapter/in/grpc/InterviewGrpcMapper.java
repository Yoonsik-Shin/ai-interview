package me.unbrdn.core.interview.adapter.in.grpc;

import me.unbrdn.core.grpc.common.v1.InterviewPersonalityProto;
import me.unbrdn.core.grpc.common.v1.InterviewRoleProto;
import me.unbrdn.core.grpc.common.v1.InterviewStageProto;
import me.unbrdn.core.grpc.common.v1.InterviewStatusProto;
import me.unbrdn.core.grpc.common.v1.InterviewTypeProto;
import me.unbrdn.core.grpc.interview.v1.InterviewSummary; // Updated import
import me.unbrdn.core.interview.application.port.in.ListInterviewsUseCase;
import me.unbrdn.core.interview.domain.enums.InterviewPersonality;
import me.unbrdn.core.interview.domain.enums.InterviewRole;
import me.unbrdn.core.interview.domain.enums.InterviewSessionStatus;
import me.unbrdn.core.interview.domain.enums.InterviewStage;
import me.unbrdn.core.interview.domain.enums.InterviewType;
import org.springframework.stereotype.Component;

@Component
public class InterviewGrpcMapper {

    public InterviewStatusProto toProtoInterviewStatus(InterviewSessionStatus status) {
        return switch (status) {
            case READY -> InterviewStatusProto.READY;
            case IN_PROGRESS -> InterviewStatusProto.IN_PROGRESS;
            case PAUSED -> InterviewStatusProto.PAUSED;
            case COMPLETED -> InterviewStatusProto.COMPLETED;
            case CANCELLED -> InterviewStatusProto.CANCELLED;
        };
    }

    public InterviewStatusProto toProtoStatus(String statusString) {
        InterviewSessionStatus status = InterviewSessionStatus.valueOf(statusString);
        return toProtoInterviewStatus(status);
    }

    public InterviewStageProto toProtoInterviewStage(InterviewStage stage) {
        return switch (stage) {
            case WAITING -> InterviewStageProto.WAITING;
            case GREETING -> InterviewStageProto.GREETING;
            case CANDIDATE_GREETING -> InterviewStageProto.CANDIDATE_GREETING;
            case INTERVIEWER_INTRO -> InterviewStageProto.INTERVIEWER_INTRO;
            case SELF_INTRO_PROMPT -> InterviewStageProto.SELF_INTRO_PROMPT;
            case SELF_INTRO -> InterviewStageProto.SELF_INTRO;
            case IN_PROGRESS -> InterviewStageProto.IN_PROGRESS_STAGE;
            case LAST_QUESTION_PROMPT -> InterviewStageProto.LAST_QUESTION_PROMPT;
            case LAST_ANSWER -> InterviewStageProto.LAST_ANSWER;
            case CLOSING_GREETING -> InterviewStageProto.CLOSING_GREETING;
            case COMPLETED -> InterviewStageProto.COMPLETED_STAGE;
        };
    }

    public InterviewRoleProto toProtoInterviewRole(InterviewRole role) {
        return switch (role) {
            case TECH -> InterviewRoleProto.TECH;
            case HR -> InterviewRoleProto.HR;
            case LEADER -> InterviewRoleProto.LEADER;
        };
    }

    public InterviewPersonalityProto toProtoInterviewPersonality(InterviewPersonality personality) {
        if (personality == null) return InterviewPersonalityProto.INTERVIEW_PERSONALITY_UNSPECIFIED;
        return switch (personality) {
            case PRESSURE -> InterviewPersonalityProto.PRESSURE;
            case COMFORTABLE -> InterviewPersonalityProto.COMFORTABLE;
            case RANDOM -> InterviewPersonalityProto.RANDOM;
        };
    }

    public InterviewTypeProto toProtoInterviewType(InterviewType type) {
        return switch (type) {
            case REAL -> InterviewTypeProto.REAL;
            case PRACTICE -> InterviewTypeProto.PRACTICE;
        };
    }

    public InterviewSummary toProtoInterviewSummary(
            ListInterviewsUseCase.InterviewSummary summary) {
        return InterviewSummary.newBuilder()
                .setInterviewId(summary.interviewId().toString())
                .setStartedAt(summary.startedAt() != null ? summary.startedAt().toString() : "")
                .setStatus(toProtoInterviewStatus(summary.status()))
                .setCompanyName(summary.companyName() != null ? summary.companyName() : "")
                .setDomain(summary.domain() != null ? summary.domain() : "")
                .setType(toProtoInterviewType(summary.type()))
                .setScheduledDurationMinutes(summary.scheduledDurationMinutes())
                .build();
    }

    // Alias for toProtoInterviewStage (used by forceStage)
    public InterviewStageProto toProtoStage(InterviewStage stage) {
        return toProtoInterviewStage(stage);
    }

    public me.unbrdn.core.grpc.interview.v1.GetInterviewResponse toProtoGetInterviewResponse(
            me.unbrdn.core.interview.application.dto.result.GetInterviewResult result) {

        var builder =
                me.unbrdn.core.grpc.interview.v1.GetInterviewResponse.newBuilder()
                        .setInterviewId(result.interviewId().toString())
                        .setStatus(toProtoInterviewStatus(result.status()))
                        .setType(toProtoInterviewType(result.type()))
                        .setCompanyName(result.companyName() != null ? result.companyName() : "")
                        .setDomain(result.domain() != null ? result.domain() : "")
                        .setScheduledDurationMinutes(result.scheduledDurationMinutes());

        if (result.participatingPersonas() != null) {
            builder.addAllParticipatingPersonas(result.participatingPersonas());
        }

        return builder.build();
    }

    public me.unbrdn.core.interview.domain.enums.InterviewStage toDomainInterviewStage(
            InterviewStageProto stageProto) {
        return switch (stageProto) {
            case WAITING -> me.unbrdn.core.interview.domain.enums.InterviewStage.WAITING;
            case GREETING -> me.unbrdn.core.interview.domain.enums.InterviewStage.GREETING;
            case CANDIDATE_GREETING -> me.unbrdn.core.interview.domain.enums.InterviewStage
                    .CANDIDATE_GREETING;
            case INTERVIEWER_INTRO -> me.unbrdn.core.interview.domain.enums.InterviewStage
                    .INTERVIEWER_INTRO;
            case SELF_INTRO_PROMPT -> me.unbrdn.core.interview.domain.enums.InterviewStage
                    .SELF_INTRO_PROMPT;
            case SELF_INTRO -> me.unbrdn.core.interview.domain.enums.InterviewStage.SELF_INTRO;
            case IN_PROGRESS_STAGE -> me.unbrdn.core.interview.domain.enums.InterviewStage
                    .IN_PROGRESS;
            case LAST_QUESTION_PROMPT -> me.unbrdn.core.interview.domain.enums.InterviewStage
                    .LAST_QUESTION_PROMPT;
            case LAST_ANSWER -> me.unbrdn.core.interview.domain.enums.InterviewStage.LAST_ANSWER;
            case CLOSING_GREETING -> me.unbrdn.core.interview.domain.enums.InterviewStage
                    .CLOSING_GREETING;
            case COMPLETED_STAGE -> me.unbrdn.core.interview.domain.enums.InterviewStage.COMPLETED;
            case INTERVIEW_STAGE_UNSPECIFIED, UNRECOGNIZED -> throw new IllegalArgumentException(
                    "Invalid Stage Proto: " + stageProto);
        };
    }

    public me.unbrdn.core.interview.domain.enums.InterviewSessionStatus toDomainInterviewStatus(
            InterviewStatusProto statusProto) {
        return switch (statusProto) {
            case READY -> InterviewSessionStatus.READY;
            case IN_PROGRESS -> InterviewSessionStatus.IN_PROGRESS;
            case PAUSED -> InterviewSessionStatus.PAUSED;
            case COMPLETED -> InterviewSessionStatus.COMPLETED;
            case CANCELLED -> InterviewSessionStatus.CANCELLED;
            case INTERVIEW_STATUS_UNSPECIFIED, UNRECOGNIZED -> throw new IllegalArgumentException(
                    "Invalid Status Proto: " + statusProto);
        };
    }
}
