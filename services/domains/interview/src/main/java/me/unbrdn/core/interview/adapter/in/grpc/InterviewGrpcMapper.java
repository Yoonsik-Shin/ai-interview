package me.unbrdn.core.interview.adapter.in.grpc;

import me.unbrdn.core.grpc.common.v1.InterviewPersonalityProto;
import me.unbrdn.core.grpc.common.v1.InterviewRoleProto;
import me.unbrdn.core.grpc.common.v1.InterviewRoundProto;
import me.unbrdn.core.grpc.common.v1.InterviewStageProto;
import me.unbrdn.core.grpc.common.v1.InterviewStatusProto;
import me.unbrdn.core.grpc.common.v1.InterviewTurnStatusProto;
import me.unbrdn.core.grpc.common.v1.InterviewTypeProto;
import me.unbrdn.core.grpc.interview.v1.InterviewSummary;
import me.unbrdn.core.interview.application.port.in.ListInterviewsUseCase;
import me.unbrdn.core.interview.domain.enums.InterviewPersonality;
import me.unbrdn.core.interview.domain.enums.InterviewRole;
import me.unbrdn.core.interview.domain.enums.InterviewRound;
import me.unbrdn.core.interview.domain.enums.InterviewSessionStatus;
import me.unbrdn.core.interview.domain.enums.InterviewStage;
import me.unbrdn.core.interview.domain.enums.InterviewType;
import me.unbrdn.core.interview.domain.model.InterviewSessionState;
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

    public InterviewTurnStatusProto toProtoTurnStatus(InterviewSessionState.Status status) {
        if (status == null) return InterviewTurnStatusProto.INTERVIEW_TURN_STATUS_UNSPECIFIED;
        return switch (status) {
            case READY -> InterviewTurnStatusProto.TURN_READY;
            case LISTENING -> InterviewTurnStatusProto.LISTENING;
            case THINKING -> InterviewTurnStatusProto.THINKING;
            case SPEAKING -> InterviewTurnStatusProto.SPEAKING;
            case PAUSED -> InterviewTurnStatusProto.TURN_PAUSED;
            case COMPLETED -> InterviewTurnStatusProto.TURN_COMPLETED;
            case CANCELLED -> InterviewTurnStatusProto.TURN_CANCELLED;
        };
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
            case EXEC -> InterviewRoleProto.EXEC;
        };
    }

    public InterviewRoundProto toProtoInterviewRound(InterviewRound round) {
        if (round == null) return InterviewRoundProto.INTERVIEW_ROUND_UNSPECIFIED;
        return switch (round) {
            case TECHNICAL -> InterviewRoundProto.TECHNICAL_ROUND;
            case CULTURE_FIT -> InterviewRoundProto.CULTURE_ROUND;
            case EXECUTIVE -> InterviewRoundProto.EXECUTIVE_ROUND;
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
                .setJobPostingUrl(summary.jobPostingUrl() != null ? summary.jobPostingUrl() : "")
                .build();
    }

    // Alias for toProtoInterviewStage (used by forceStage)
    public InterviewStageProto toProtoStage(InterviewStage stage) {
        return toProtoInterviewStage(stage);
    }

    public me.unbrdn.core.grpc.interview.v1.GetInterviewResponse toProtoGetInterviewResponse(
            me.unbrdn.core.interview.application.dto.result.GetInterviewResult result) {

        me.unbrdn.core.grpc.interview.v1.GetInterviewResponse.Builder builder =
                me.unbrdn.core.grpc.interview.v1.GetInterviewResponse.newBuilder()
                        .setInterviewId(result.interviewId().toString())
                        .setStatus(toProtoInterviewStatus(result.status()))
                        .setCurrentStage(toProtoInterviewStage(result.currentStage()))
                        .setType(toProtoInterviewType(result.type()))
                        .setCompanyName(result.companyName() != null ? result.companyName() : "")
                        .setDomain(result.domain() != null ? result.domain() : "")
                        .setScheduledDurationMinutes(result.scheduledDurationMinutes())
                        .setRound(toProtoInterviewRound(result.round()))
                        .setJobPostingUrl(
                                result.jobPostingUrl() != null ? result.jobPostingUrl() : "")
                        .setSelfIntroText(
                                result.selfIntroText() != null ? result.selfIntroText() : "")
                        .setTurnCount(result.turnCount());

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

    public me.unbrdn.core.interview.domain.enums.InterviewRound toDomainInterviewRound(
            InterviewRoundProto roundProto) {
        if (roundProto == null) return null;
        return switch (roundProto) {
            case TECHNICAL_ROUND -> InterviewRound.TECHNICAL;
            case CULTURE_ROUND -> InterviewRound.CULTURE_FIT;
            case EXECUTIVE_ROUND -> InterviewRound.EXECUTIVE;
            case INTERVIEW_ROUND_UNSPECIFIED, UNRECOGNIZED -> null;
        };
    }

    public me.unbrdn.core.interview.domain.enums.InterviewType toDomainInterviewType(
            InterviewTypeProto typeProto) {
        return switch (typeProto) {
            case REAL -> InterviewType.REAL;
            case PRACTICE -> InterviewType.PRACTICE;
            case INTERVIEW_TYPE_UNSPECIFIED, UNRECOGNIZED -> InterviewType.PRACTICE;
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
