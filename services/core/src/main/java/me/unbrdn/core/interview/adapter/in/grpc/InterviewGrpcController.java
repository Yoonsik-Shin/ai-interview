package me.unbrdn.core.interview.adapter.in.grpc;

import io.grpc.stub.StreamObserver;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.grpc.InterviewProto.CreateInterviewRequest;
import me.unbrdn.core.grpc.InterviewProto.CreateInterviewResponse;
import me.unbrdn.core.grpc.InterviewProto.InterviewPersonaProto;
import me.unbrdn.core.grpc.InterviewProto.InterviewStatusProto;
import me.unbrdn.core.grpc.InterviewProto.InterviewTypeProto;
import me.unbrdn.core.grpc.InterviewServiceGrpcGrpc;
import me.unbrdn.core.interview.application.dto.command.CreateInterviewCommand;
import me.unbrdn.core.interview.application.dto.result.CreateInterviewResult;
import me.unbrdn.core.interview.application.port.in.CreateInterviewUseCase;
import me.unbrdn.core.interview.domain.enums.InterviewPersona;
import me.unbrdn.core.interview.domain.enums.InterviewSessionStatus;
import me.unbrdn.core.interview.domain.enums.InterviewType;
import net.devh.boot.grpc.server.service.GrpcService;

/** Interview Application Service의 gRPC 진입점 */
@GrpcService
@Slf4j
@RequiredArgsConstructor
public class InterviewGrpcController extends InterviewServiceGrpcGrpc.InterviewServiceGrpcImplBase {

    private final CreateInterviewUseCase createInterviewUseCase;
    private final me.unbrdn.core.interview.application.port.in.GetInterviewStageUseCase getInterviewStageUseCase;
    private final me.unbrdn.core.interview.application.port.in.TransitionInterviewStageUseCase transitionInterviewStageUseCase;

    @Override
    public void createInterview(CreateInterviewRequest request,
            StreamObserver<CreateInterviewResponse> responseObserver) {
        log.info("gRPC request received: CreateInterview userId={}", request.getUserId());

        CreateInterviewCommand command = CreateInterviewCommand.builder().userId(UUID.fromString(request.getUserId()))
                // resumeId가 빈 문자열이면 null로 처리
                .resumeId(Optional.ofNullable(hasResumeId(request) ? UUID.fromString(request.getResumeId()) : null))
                .type(toDomainInterviewType(request.getType())).persona(toDomainInterviewPersona(request.getPersona()))
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

    private static InterviewType toDomainInterviewType(InterviewTypeProto proto) {
        return switch (proto) {
        case REAL -> InterviewType.REAL;
        case PRACTICE -> InterviewType.PRACTICE;
        default -> InterviewType.PRACTICE;
        };
    }

    private static InterviewPersona toDomainInterviewPersona(InterviewPersonaProto proto) {
        return switch (proto) {
        case PRESSURE -> InterviewPersona.PRESSURE;
        case COMFORTABLE -> InterviewPersona.COMFORTABLE;
        case RANDOM -> InterviewPersona.RANDOM;
        default -> InterviewPersona.COMFORTABLE;
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
    public void getInterviewStage(me.unbrdn.core.grpc.InterviewProto.GetInterviewStageRequest request,
            StreamObserver<me.unbrdn.core.grpc.InterviewProto.GetInterviewStageResponse> responseObserver) {
        log.info("gRPC request received: GetInterviewStage interviewSessionId={}", request.getInterviewSessionId());

        try {
            UUID interviewSessionId = UUID.fromString(request.getInterviewSessionId());
            me.unbrdn.core.interview.application.port.in.GetInterviewStageUseCase.GetInterviewStageQuery query = new me.unbrdn.core.interview.application.port.in.GetInterviewStageUseCase.GetInterviewStageQuery(
                    interviewSessionId);

            me.unbrdn.core.interview.application.port.in.GetInterviewStageUseCase.InterviewStageResult result = getInterviewStageUseCase
                    .execute(query);

            me.unbrdn.core.grpc.InterviewProto.GetInterviewStageResponse.Builder responseBuilder = me.unbrdn.core.grpc.InterviewProto.GetInterviewStageResponse
                    .newBuilder().setStage(toProtoInterviewStage(result.stage()))
                    .setSelfIntroElapsedSeconds(result.selfIntroElapsedSeconds());

            if (result.persona() != null) {
                responseBuilder.setPersona(result.persona());
            }
            if (result.interviewerCount() != null) {
                responseBuilder.setInterviewerCount(result.interviewerCount());
            }
            if (result.domain() != null) {
                responseBuilder.setDomain(result.domain());
            }

            responseObserver.onNext(responseBuilder.build());
            responseObserver.onCompleted();
            log.info("gRPC response sent: stage={}", result.stage());
        } catch (Exception e) {
            log.error("Error in getInterviewStage", e);
            responseObserver.onError(io.grpc.Status.INTERNAL
                    .withDescription("Failed to get interview stage: " + e.getMessage()).asRuntimeException());
        }
    }

    @Override
    public void transitionStage(me.unbrdn.core.grpc.InterviewProto.TransitionStageRequest request,
            StreamObserver<me.unbrdn.core.grpc.InterviewProto.TransitionStageResponse> responseObserver) {
        log.info("gRPC request received: TransitionStage interviewSessionId={}, newStage={}",
                request.getInterviewSessionId(), request.getNewStage());

        try {
            UUID interviewSessionId = UUID.fromString(request.getInterviewSessionId());
            me.unbrdn.core.interview.domain.enums.InterviewStage newStage = toDomainInterviewStage(
                    request.getNewStage());

            me.unbrdn.core.interview.application.port.in.TransitionInterviewStageUseCase.TransitionStageCommand command = new me.unbrdn.core.interview.application.port.in.TransitionInterviewStageUseCase.TransitionStageCommand(
                    interviewSessionId, newStage);

            transitionInterviewStageUseCase.execute(command);

            // 다시 조회해서 현재 stage 반환
            me.unbrdn.core.interview.application.port.in.GetInterviewStageUseCase.GetInterviewStageQuery query = new me.unbrdn.core.interview.application.port.in.GetInterviewStageUseCase.GetInterviewStageQuery(
                    interviewSessionId);
            me.unbrdn.core.interview.application.port.in.GetInterviewStageUseCase.InterviewStageResult result = getInterviewStageUseCase
                    .execute(query);

            me.unbrdn.core.grpc.InterviewProto.TransitionStageResponse response = me.unbrdn.core.grpc.InterviewProto.TransitionStageResponse
                    .newBuilder().setCurrentStage(toProtoInterviewStage(result.stage())).build();

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

    private static me.unbrdn.core.grpc.InterviewProto.InterviewStageProto toProtoInterviewStage(
            me.unbrdn.core.interview.domain.enums.InterviewStage stage) {
        return switch (stage) {
        case WAITING -> me.unbrdn.core.grpc.InterviewProto.InterviewStageProto.WAITING;
        case GREETING -> me.unbrdn.core.grpc.InterviewProto.InterviewStageProto.GREETING;
        case CANDIDATE_GREETING -> me.unbrdn.core.grpc.InterviewProto.InterviewStageProto.CANDIDATE_GREETING;
        case INTERVIEWER_INTRO -> me.unbrdn.core.grpc.InterviewProto.InterviewStageProto.INTERVIEWER_INTRO;
        case SELF_INTRO_PROMPT -> me.unbrdn.core.grpc.InterviewProto.InterviewStageProto.SELF_INTRO_PROMPT;
        case SELF_INTRO -> me.unbrdn.core.grpc.InterviewProto.InterviewStageProto.SELF_INTRO;
        case IN_PROGRESS -> me.unbrdn.core.grpc.InterviewProto.InterviewStageProto.IN_PROGRESS_STAGE;
        case COMPLETED -> me.unbrdn.core.grpc.InterviewProto.InterviewStageProto.COMPLETED_STAGE;
        };
    }

    private static me.unbrdn.core.interview.domain.enums.InterviewStage toDomainInterviewStage(
            me.unbrdn.core.grpc.InterviewProto.InterviewStageProto proto) {
        return switch (proto) {
        case WAITING -> me.unbrdn.core.interview.domain.enums.InterviewStage.WAITING;
        case GREETING -> me.unbrdn.core.interview.domain.enums.InterviewStage.GREETING;
        case CANDIDATE_GREETING -> me.unbrdn.core.interview.domain.enums.InterviewStage.CANDIDATE_GREETING;
        case INTERVIEWER_INTRO -> me.unbrdn.core.interview.domain.enums.InterviewStage.INTERVIEWER_INTRO;
        case SELF_INTRO_PROMPT -> me.unbrdn.core.interview.domain.enums.InterviewStage.SELF_INTRO_PROMPT;
        case SELF_INTRO -> me.unbrdn.core.interview.domain.enums.InterviewStage.SELF_INTRO;
        case IN_PROGRESS_STAGE -> me.unbrdn.core.interview.domain.enums.InterviewStage.IN_PROGRESS;
        case COMPLETED_STAGE -> me.unbrdn.core.interview.domain.enums.InterviewStage.COMPLETED;
        default -> throw new IllegalArgumentException("Unknown stage proto: " + proto);
        };
    }
}
