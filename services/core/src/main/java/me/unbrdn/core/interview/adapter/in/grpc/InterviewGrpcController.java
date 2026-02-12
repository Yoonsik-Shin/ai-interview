package me.unbrdn.core.interview.adapter.in.grpc;

import io.grpc.stub.StreamObserver;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.devh.boot.grpc.server.service.GrpcService;

import me.unbrdn.core.grpc.interview.v1.CreateInterviewRequest;
import me.unbrdn.core.grpc.interview.v1.CreateInterviewResponse;
import me.unbrdn.core.grpc.common.v1.InterviewStatusProto;
import me.unbrdn.core.grpc.common.v1.InterviewTypeProto;
import me.unbrdn.core.grpc.interview.v1.InterviewServiceGrpc;
import me.unbrdn.core.interview.application.dto.command.CreateInterviewCommand;
import me.unbrdn.core.interview.application.dto.result.CreateInterviewResult;
import me.unbrdn.core.interview.application.port.in.CreateInterviewUseCase;
import me.unbrdn.core.interview.domain.enums.InterviewSessionStatus;
import me.unbrdn.core.interview.domain.enums.InterviewType;
import me.unbrdn.core.interview.application.port.in.GetInterviewStageUseCase;
import me.unbrdn.core.interview.application.port.in.TransitionInterviewStageUseCase;
import me.unbrdn.core.interview.application.port.in.IncrementSelfIntroRetryUseCase;
import me.unbrdn.core.interview.application.port.in.ListInterviewsUseCase;
import me.unbrdn.core.grpc.interview.v1.IncrementSelfIntroRetryRequest;
import me.unbrdn.core.grpc.interview.v1.IncrementSelfIntroRetryResponse;
import me.unbrdn.core.grpc.interview.v1.GetInterviewStageRequest;
import me.unbrdn.core.grpc.interview.v1.GetInterviewStageResponse;
import me.unbrdn.core.grpc.interview.v1.ListInterviewsRequest;
import me.unbrdn.core.grpc.interview.v1.ListInterviewsResponse;
import me.unbrdn.core.grpc.interview.v1.InterviewSessionSummary;
import me.unbrdn.core.interview.domain.enums.InterviewRole;
import me.unbrdn.core.interview.domain.enums.InterviewPersonality;
import me.unbrdn.core.interview.application.port.in.GetInterviewStageUseCase.GetInterviewStageQuery;
import me.unbrdn.core.interview.application.port.in.GetInterviewStageUseCase.InterviewStageResult;
import me.unbrdn.core.grpc.interview.v1.TransitionStageResponse;
import me.unbrdn.core.grpc.interview.v1.TransitionStageRequest;
import me.unbrdn.core.interview.application.port.in.TransitionInterviewStageUseCase.TransitionStageCommand;

/** Interview Application Service의 gRPC 진입점 */
@GrpcService
@Slf4j
@RequiredArgsConstructor
public class InterviewGrpcController extends InterviewServiceGrpc.InterviewServiceImplBase {

    private final CreateInterviewUseCase createInterviewUseCase;
    private final GetInterviewStageUseCase getInterviewStageUseCase;
    private final TransitionInterviewStageUseCase transitionInterviewStageUseCase;
    private final IncrementSelfIntroRetryUseCase incrementSelfIntroRetryUseCase;
    private final ListInterviewsUseCase listInterviewsUseCase;

    @Override
    public void incrementSelfIntroRetry(IncrementSelfIntroRetryRequest request,
            StreamObserver<IncrementSelfIntroRetryResponse> responseObserver) {
        log.debug("gRPC request received: IncrementSelfIntroRetry interviewSessionId={}",
                request.getInterviewSessionId());

        try {
            UUID interviewSessionId = UUID.fromString(request.getInterviewSessionId());
            int newCount = incrementSelfIntroRetryUseCase.execute(interviewSessionId);

            IncrementSelfIntroRetryResponse response = IncrementSelfIntroRetryResponse.newBuilder()
                    .setNewRetryCount(newCount).build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.error("Error in incrementSelfIntroRetry", e);
            responseObserver.onError(io.grpc.Status.INTERNAL
                    .withDescription("Failed to increment self intro retry: " + e.getMessage()).asRuntimeException());
        }
    }

    @Override
    public void createInterview(CreateInterviewRequest request,
            StreamObserver<CreateInterviewResponse> responseObserver) {
        log.info("gRPC request received: CreateInterview userId={}", request.getUserId());

        CreateInterviewCommand command = CreateInterviewCommand.builder().userId(UUID.fromString(request.getUserId()))
                // resumeId가 빈 문자열이면 null로 처리
                .resumeId(Optional.ofNullable(hasResumeId(request) ? UUID.fromString(request.getResumeId()) : null))
                .type(toDomainInterviewType(request.getType()))
                .roles(request.getInterviewerRolesList().stream().map(InterviewGrpcController::toDomainInterviewRole)
                        .toList())
                .personality(toDomainInterviewPersonality(request.getPersonality()))
                .interviewerCount(request.getInterviewerCount()).domain(request.getDomain())
                .targetDurationMinutes(request.getTargetDurationMinutes())
                .selfIntroduction(request.getSelfIntroduction()).build();

        CreateInterviewResult result = createInterviewUseCase.execute(command);
        CreateInterviewResponse response = buildResponse(result);

        responseObserver.onNext(response);
        responseObserver.onCompleted();
        log.info("gRPC response sent: interviewId={}", result.getInterviewId());
    }

    private CreateInterviewResponse buildResponse(CreateInterviewResult result) {
        InterviewSessionStatus status = result.getStatus() == null ? InterviewSessionStatus.READY : result.getStatus();
        return CreateInterviewResponse.newBuilder().setInterviewId(result.getInterviewId().toString())
                .setStatus(toProtoInterviewStatus(status)).build();
    }

    private boolean hasResumeId(CreateInterviewRequest request) {
        return request.hasResumeId() && !request.getResumeId().isEmpty();
    }

    @Override
    public void listInterviews(ListInterviewsRequest request, StreamObserver<ListInterviewsResponse> responseObserver) {
        log.info("gRPC request received: ListInterviews userId={}", request.getUserId());

        try {
            UUID userId = UUID.fromString(request.getUserId());
            var summaries = listInterviewsUseCase.execute(userId);

            ListInterviewsResponse.Builder responseBuilder = ListInterviewsResponse.newBuilder();

            responseBuilder.addAllInterviews(summaries.stream().map(this::toProtoInterviewSummary).toList());

            responseObserver.onNext(responseBuilder.build());
            responseObserver.onCompleted();
            log.info("gRPC response sent: count={}", summaries.size());
        } catch (Exception e) {
            log.error("Error in listInterviews", e);
            responseObserver.onError(io.grpc.Status.INTERNAL
                    .withDescription("Failed to list interviews: " + e.getMessage()).asRuntimeException());
        }
    }

    private InterviewSessionSummary toProtoInterviewSummary(ListInterviewsUseCase.InterviewSummary summary) {
        return InterviewSessionSummary.newBuilder().setInterviewId(summary.interviewId().toString())
                .setStartedAt(summary.startedAt() != null ? summary.startedAt().toString() : "")
                .setStatus(toProtoInterviewStatus(summary.status())).setDomain(summary.domain())
                .setType(toProtoInterviewType(summary.type())).setTargetDurationMinutes(summary.targetDurationMinutes())
                .setInterviewerCount(summary.interviewerCount()).build();
    }

    // ==================== Stage Management RPCs ====================

    private static InterviewType toDomainInterviewType(InterviewTypeProto proto) {
        return switch (proto) {
        case REAL -> InterviewType.REAL;
        case PRACTICE -> InterviewType.PRACTICE;
        default -> InterviewType.PRACTICE;
        };
    }

    private static InterviewRole toDomainInterviewRole(me.unbrdn.core.grpc.common.v1.InterviewRoleProto proto) {
        return switch (proto) {
        case TECH -> InterviewRole.TECH;
        case HR -> InterviewRole.HR;
        case LEADER -> InterviewRole.LEADER;
        default -> InterviewRole.TECH;
        };
    }

    private static InterviewPersonality toDomainInterviewPersonality(
            me.unbrdn.core.grpc.common.v1.InterviewPersonalityProto proto) {
        return switch (proto) {
        case PRESSURE -> InterviewPersonality.PRESSURE;
        case COMFORTABLE -> InterviewPersonality.COMFORTABLE;
        case RANDOM -> InterviewPersonality.RANDOM;
        default -> InterviewPersonality.COMFORTABLE;
        };
    }

    private static InterviewStatusProto toProtoInterviewStatus(InterviewSessionStatus status) {
        return switch (status) {
        case READY -> InterviewStatusProto.READY;
        case IN_PROGRESS -> InterviewStatusProto.IN_PROGRESS;
        case COMPLETED -> InterviewStatusProto.COMPLETED;
        case CANCELLED -> InterviewStatusProto.CANCELLED;
        };
    }

    // ==================== Stage Management RPCs ====================

    @Override
    public void getInterviewStage(GetInterviewStageRequest request,
            StreamObserver<GetInterviewStageResponse> responseObserver) {
        log.debug("gRPC request received: GetInterviewStage interviewSessionId={}", request.getInterviewSessionId());

        try {
            UUID interviewSessionId = UUID.fromString(request.getInterviewSessionId());
            GetInterviewStageQuery query = new GetInterviewStageQuery(interviewSessionId);

            InterviewStageResult result = getInterviewStageUseCase.execute(query);

            GetInterviewStageResponse.Builder responseBuilder = GetInterviewStageResponse.newBuilder()
                    .setStage(toProtoInterviewStage(result.stage()))
                    .setSelfIntroElapsedSeconds(result.selfIntroElapsedSeconds());

            if (result.roles() != null) {
                responseBuilder.addAllInterviewerRoles(
                        result.roles().stream().map(InterviewGrpcController::toProtoInterviewRole).toList());
            }
            if (result.personality() != null) {
                responseBuilder.setPersonality(toProtoInterviewPersonality(result.personality()));
            }
            if (result.interviewerCount() != null) {
                responseBuilder.setInterviewerCount(result.interviewerCount());
            }
            if (result.domain() != null) {
                responseBuilder.setDomain(result.domain());
            }
            responseBuilder.setSelfIntroRetryCount(result.selfIntroRetryCount());

            responseObserver.onNext(responseBuilder.build());
            responseObserver.onCompleted();
            log.debug("gRPC response sent: stage={}", result.stage());
        } catch (Exception e) {
            log.error("Error in getInterviewStage", e);
            responseObserver.onError(io.grpc.Status.INTERNAL
                    .withDescription("Failed to get interview stage: " + e.getMessage()).asRuntimeException());
        }
    }

    @Override
    public void transitionStage(TransitionStageRequest request,
            StreamObserver<TransitionStageResponse> responseObserver) {
        log.info("gRPC request received: TransitionStage interviewSessionId={}, newStage={}",
                request.getInterviewSessionId(), request.getNewStage());

        try {
            UUID interviewSessionId = UUID.fromString(request.getInterviewSessionId());
            me.unbrdn.core.interview.domain.enums.InterviewStage newStage = toDomainInterviewStage(
                    request.getNewStage());

            TransitionStageCommand command = new TransitionStageCommand(interviewSessionId, newStage);

            transitionInterviewStageUseCase.execute(command);

            // 다시 조회해서 현재 stage 반환
            GetInterviewStageQuery query = new GetInterviewStageQuery(interviewSessionId);
            InterviewStageResult result = getInterviewStageUseCase.execute(query);

            TransitionStageResponse response = TransitionStageResponse.newBuilder()
                    .setCurrentStage(toProtoInterviewStage(result.stage())).build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();
            log.info("gRPC response sent: currentStage={}", result.stage());
        } catch (IllegalArgumentException e) {
            log.error("Invalid stage transition", e);
            responseObserver
                    .onError(io.grpc.Status.INVALID_ARGUMENT.withDescription(e.getMessage()).asRuntimeException());
        } catch (Exception e) {
            log.error("Error in transitionStage", e);
            responseObserver.onError(io.grpc.Status.INTERNAL
                    .withDescription("Failed to transition stage: " + e.getMessage()).asRuntimeException());
        }
    }

    private static me.unbrdn.core.grpc.common.v1.InterviewTypeProto toProtoInterviewType(
            me.unbrdn.core.interview.domain.enums.InterviewType type) {
        return switch (type) {
        case REAL -> me.unbrdn.core.grpc.common.v1.InterviewTypeProto.REAL;
        case PRACTICE -> me.unbrdn.core.grpc.common.v1.InterviewTypeProto.PRACTICE;
        };
    }

    private static me.unbrdn.core.grpc.common.v1.InterviewStageProto toProtoInterviewStage(
            me.unbrdn.core.interview.domain.enums.InterviewStage stage) {
        return switch (stage) {
        case WAITING -> me.unbrdn.core.grpc.common.v1.InterviewStageProto.WAITING;
        case GREETING -> me.unbrdn.core.grpc.common.v1.InterviewStageProto.GREETING;
        case CANDIDATE_GREETING -> me.unbrdn.core.grpc.common.v1.InterviewStageProto.CANDIDATE_GREETING;
        case INTERVIEWER_INTRO -> me.unbrdn.core.grpc.common.v1.InterviewStageProto.INTERVIEWER_INTRO;
        case SELF_INTRO_PROMPT -> me.unbrdn.core.grpc.common.v1.InterviewStageProto.SELF_INTRO_PROMPT;
        case SELF_INTRO -> me.unbrdn.core.grpc.common.v1.InterviewStageProto.SELF_INTRO;
        case IN_PROGRESS -> me.unbrdn.core.grpc.common.v1.InterviewStageProto.IN_PROGRESS_STAGE;
        case LAST_QUESTION_PROMPT -> me.unbrdn.core.grpc.common.v1.InterviewStageProto.LAST_QUESTION_PROMPT;
        case LAST_ANSWER -> me.unbrdn.core.grpc.common.v1.InterviewStageProto.LAST_ANSWER;
        case CLOSING_GREETING -> me.unbrdn.core.grpc.common.v1.InterviewStageProto.CLOSING_GREETING;
        case COMPLETED -> me.unbrdn.core.grpc.common.v1.InterviewStageProto.COMPLETED_STAGE;
        };
    }

    private static me.unbrdn.core.interview.domain.enums.InterviewStage toDomainInterviewStage(
            me.unbrdn.core.grpc.common.v1.InterviewStageProto proto) {
        return switch (proto) {
        case WAITING -> me.unbrdn.core.interview.domain.enums.InterviewStage.WAITING;
        case GREETING -> me.unbrdn.core.interview.domain.enums.InterviewStage.GREETING;
        case CANDIDATE_GREETING -> me.unbrdn.core.interview.domain.enums.InterviewStage.CANDIDATE_GREETING;
        case INTERVIEWER_INTRO -> me.unbrdn.core.interview.domain.enums.InterviewStage.INTERVIEWER_INTRO;
        case SELF_INTRO_PROMPT -> me.unbrdn.core.interview.domain.enums.InterviewStage.SELF_INTRO_PROMPT;
        case SELF_INTRO -> me.unbrdn.core.interview.domain.enums.InterviewStage.SELF_INTRO;
        case IN_PROGRESS_STAGE -> me.unbrdn.core.interview.domain.enums.InterviewStage.IN_PROGRESS;
        case LAST_QUESTION_PROMPT -> me.unbrdn.core.interview.domain.enums.InterviewStage.LAST_QUESTION_PROMPT;
        case LAST_ANSWER -> me.unbrdn.core.interview.domain.enums.InterviewStage.LAST_ANSWER;
        case CLOSING_GREETING -> me.unbrdn.core.interview.domain.enums.InterviewStage.CLOSING_GREETING;
        case COMPLETED_STAGE -> me.unbrdn.core.interview.domain.enums.InterviewStage.COMPLETED;
        default -> throw new IllegalArgumentException("Unknown stage proto: " + proto);
        };
    }

    private static me.unbrdn.core.grpc.common.v1.InterviewRoleProto toProtoInterviewRole(
            me.unbrdn.core.interview.domain.enums.InterviewRole role) {
        return switch (role) {
        case TECH -> me.unbrdn.core.grpc.common.v1.InterviewRoleProto.TECH;
        case HR -> me.unbrdn.core.grpc.common.v1.InterviewRoleProto.HR;
        case LEADER -> me.unbrdn.core.grpc.common.v1.InterviewRoleProto.LEADER;
        };
    }

    private static me.unbrdn.core.grpc.common.v1.InterviewPersonalityProto toProtoInterviewPersonality(
            me.unbrdn.core.interview.domain.enums.InterviewPersonality personality) {
        if (personality == null)
            return me.unbrdn.core.grpc.common.v1.InterviewPersonalityProto.INTERVIEW_PERSONALITY_UNSPECIFIED;
        return switch (personality) {
        case PRESSURE -> me.unbrdn.core.grpc.common.v1.InterviewPersonalityProto.PRESSURE;
        case COMFORTABLE -> me.unbrdn.core.grpc.common.v1.InterviewPersonalityProto.COMFORTABLE;
        case RANDOM -> me.unbrdn.core.grpc.common.v1.InterviewPersonalityProto.RANDOM;
        };
    }
}
