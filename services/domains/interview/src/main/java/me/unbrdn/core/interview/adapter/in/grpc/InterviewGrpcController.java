package me.unbrdn.core.interview.adapter.in.grpc;

import io.grpc.stub.StreamObserver;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.common.infrastructure.grpc.GlobalGrpcExceptionHandler;
import me.unbrdn.core.grpc.interview.v1.CancelInterviewRequest;
import me.unbrdn.core.grpc.interview.v1.CancelInterviewResponse;
import me.unbrdn.core.grpc.interview.v1.CompleteInterviewRequest;
import me.unbrdn.core.grpc.interview.v1.CompleteInterviewResponse;
import me.unbrdn.core.grpc.interview.v1.CompleteRecordingSegmentUploadRequest;
import me.unbrdn.core.grpc.interview.v1.CompleteRecordingSegmentUploadResponse;
import me.unbrdn.core.grpc.interview.v1.CreateInterviewReportRequest;
import me.unbrdn.core.grpc.interview.v1.CreateInterviewReportResponse;
import me.unbrdn.core.grpc.interview.v1.CreateInterviewRequest;
import me.unbrdn.core.grpc.interview.v1.CreateInterviewResponse;
import me.unbrdn.core.grpc.interview.v1.GetInterviewHistoryRequest;
import me.unbrdn.core.grpc.interview.v1.GetInterviewHistoryResponse;
import me.unbrdn.core.grpc.interview.v1.GetInterviewRecordingSegmentsRequest;
import me.unbrdn.core.grpc.interview.v1.GetInterviewRecordingSegmentsResponse;
import me.unbrdn.core.grpc.interview.v1.GetInterviewReportRequest;
import me.unbrdn.core.grpc.interview.v1.GetInterviewReportResponse;
import me.unbrdn.core.grpc.interview.v1.GetInterviewStageRequest;
import me.unbrdn.core.grpc.interview.v1.GetInterviewStageResponse;
import me.unbrdn.core.grpc.interview.v1.GetRecordingSegmentUploadUrlRequest;
import me.unbrdn.core.grpc.interview.v1.GetRecordingSegmentUploadUrlResponse;
import me.unbrdn.core.grpc.interview.v1.InterviewMessage;
import me.unbrdn.core.grpc.interview.v1.InterviewServiceGrpc;
import me.unbrdn.core.grpc.interview.v1.ListInterviewsRequest;
import me.unbrdn.core.grpc.interview.v1.ListInterviewsResponse;
import me.unbrdn.core.grpc.interview.v1.PauseInterviewRequest;
import me.unbrdn.core.grpc.interview.v1.PauseInterviewResponse;
import me.unbrdn.core.grpc.interview.v1.ProcessUserAnswerRequest;
import me.unbrdn.core.grpc.interview.v1.ProcessUserAnswerResponse;
import me.unbrdn.core.grpc.interview.v1.RecordingSegment;
import me.unbrdn.core.grpc.interview.v1.ResumeInterviewRequest;
import me.unbrdn.core.grpc.interview.v1.ResumeInterviewResponse;
import me.unbrdn.core.grpc.interview.v1.RetrySelfIntroRequest;
import me.unbrdn.core.grpc.interview.v1.RetrySelfIntroResponse;
import me.unbrdn.core.grpc.interview.v1.SaveInterviewMessageRequest;
import me.unbrdn.core.grpc.interview.v1.SaveInterviewMessageResponse;
import me.unbrdn.core.grpc.interview.v1.TransitionStageRequest;
import me.unbrdn.core.grpc.interview.v1.TransitionStageResponse;
import me.unbrdn.core.interview.application.dto.command.CreateInterviewCommand;
import me.unbrdn.core.interview.application.dto.command.ProcessUserAnswerCommand;
import me.unbrdn.core.interview.application.dto.command.SaveInterviewMessageCommand;
import me.unbrdn.core.interview.application.dto.result.CreateInterviewResult;
import me.unbrdn.core.interview.application.port.in.CompleteSegmentUploadUseCase;
import me.unbrdn.core.interview.application.port.in.CreateInterviewReportUseCase;
import me.unbrdn.core.interview.application.port.in.CreateInterviewUseCase;
import me.unbrdn.core.interview.application.port.in.GetInterviewHistoryUseCase;
import me.unbrdn.core.interview.application.port.in.GetInterviewHistoryUseCase.InterviewMessageDto;
import me.unbrdn.core.interview.application.port.in.GetInterviewRecordingSegmentsUseCase;
import me.unbrdn.core.interview.application.port.in.GetInterviewReportUseCase;
import me.unbrdn.core.interview.application.port.in.GetInterviewStageUseCase;
import me.unbrdn.core.interview.application.port.in.GetInterviewStageUseCase.GetInterviewStageQuery;
import me.unbrdn.core.interview.application.port.in.GetInterviewStageUseCase.InterviewStageResult;
import me.unbrdn.core.interview.application.port.in.GetUploadUrlForSegmentUseCase;
import me.unbrdn.core.interview.application.port.in.ListInterviewsUseCase;
import me.unbrdn.core.interview.application.port.in.ProcessUserAnswerUseCase;
import me.unbrdn.core.interview.application.port.in.RetrySelfIntroUseCase;
import me.unbrdn.core.interview.application.port.in.SaveInterviewMessageUseCase;
import me.unbrdn.core.interview.application.port.in.TransitionInterviewStageUseCase;
import me.unbrdn.core.interview.application.port.in.TransitionInterviewStageUseCase.TransitionStageCommand;
import me.unbrdn.core.interview.domain.enums.InterviewSessionStatus;
import me.unbrdn.core.interview.domain.enums.MessageRole;
import net.devh.boot.grpc.server.service.GrpcService;

/** Interview Application Service의 gRPC 진입점 */
@GrpcService
@Slf4j
@RequiredArgsConstructor
public class InterviewGrpcController extends InterviewServiceGrpc.InterviewServiceImplBase {

    private final CreateInterviewUseCase createInterviewUseCase;
    private final GetInterviewStageUseCase getInterviewStageUseCase;
    private final TransitionInterviewStageUseCase transitionInterviewStageUseCase;
    private final RetrySelfIntroUseCase retrySelfIntroUseCase;
    private final ListInterviewsUseCase listInterviewsUseCase;
    private final GetInterviewHistoryUseCase getInterviewHistoryUseCase;
    private final me.unbrdn.core.interview.application.port.in.CompleteInterviewUseCase
            completeInterviewUseCase;
    private final me.unbrdn.core.interview.application.port.in.CancelInterviewUseCase
            cancelInterviewUseCase;
    private final me.unbrdn.core.interview.application.port.in.PauseInterviewUseCase
            pauseInterviewUseCase;
    private final me.unbrdn.core.interview.application.port.in.ResumeInterviewUseCase
            resumeInterviewUseCase;
    private final me.unbrdn.core.interview.application.port.in.ForceStageUseCase forceStageUseCase;
    private final me.unbrdn.core.interview.application.port.in.GetInterviewUseCase
            getInterviewUseCase;
    private final CreateInterviewReportUseCase createInterviewReportUseCase;
    private final GetInterviewReportUseCase getInterviewReportUseCase;
    private final GetUploadUrlForSegmentUseCase getUploadUrlForSegmentUseCase;
    private final CompleteSegmentUploadUseCase completeSegmentUploadUseCase;
    private final GetInterviewRecordingSegmentsUseCase getInterviewRecordingSegmentsUseCase;
    private final ProcessUserAnswerUseCase processUserAnswerUseCase;
    private final SaveInterviewMessageUseCase saveInterviewMessageUseCase;
    private final InterviewGrpcMapper mapper;

    @Override
    public void processUserAnswer(
            ProcessUserAnswerRequest request,
            StreamObserver<ProcessUserAnswerResponse> responseObserver) {
        ProcessUserAnswerCommand command =
                ProcessUserAnswerCommand.builder()
                        .interviewId(request.getInterviewId())
                        .userId(request.getUserId())
                        .userText(request.getUserText())
                        .build();
        processUserAnswerUseCase.execute(command);
        responseObserver.onNext(ProcessUserAnswerResponse.newBuilder().setSuccess(true).build());
        responseObserver.onCompleted();
    }

    @Override
    public void saveInterviewMessage(
            SaveInterviewMessageRequest request,
            StreamObserver<SaveInterviewMessageResponse> responseObserver) {
        SaveInterviewMessageCommand command =
                SaveInterviewMessageCommand.builder()
                        .interviewId(request.getInterviewId())
                        .role(MessageRole.valueOf(request.getRole()))
                        .sentence(request.getContent())
                        .stage(request.hasStage() ? request.getStage() : null)
                        .personaId(request.hasPersonaId() ? request.getPersonaId() : null)
                        .turnCount(request.getTurnCount())
                        .sentenceIndex(request.getSequenceNumber())
                        .difficultyLevel(
                                request.hasDifficultyLevel() ? request.getDifficultyLevel() : null)
                        .isFinal(true)
                        .build();

        saveInterviewMessageUseCase.execute(command);
        responseObserver.onNext(SaveInterviewMessageResponse.newBuilder().setSuccess(true).build());
        responseObserver.onCompleted();
    }

    @Override
    public void retrySelfIntro(
            RetrySelfIntroRequest request,
            StreamObserver<RetrySelfIntroResponse> responseObserver) {

        UUID interviewId = UUID.fromString(request.getInterviewId());
        RetrySelfIntroUseCase.Result result =
                retrySelfIntroUseCase.execute(interviewId, request.getDurationSeconds());

        RetrySelfIntroResponse response =
                RetrySelfIntroResponse.newBuilder()
                        .setSuccess(true)
                        .setNewRetryCount(result.getNewRetryCount())
                        .setIsMaxRetryExceeded(result.isMaxRetryExceeded())
                        .build();
        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void createInterview(
            CreateInterviewRequest request,
            StreamObserver<CreateInterviewResponse> responseObserver) {

        List<String> roles = request.getParticipatingPersonasList();

        CreateInterviewCommand command =
                CreateInterviewCommand.builder()
                        .userId(UUID.fromString(request.getUserId()))
                        .resumeId(
                                Optional.ofNullable(
                                        hasResumeId(request)
                                                ? UUID.fromString(request.getResumeId())
                                                : null))
                        .companyName(request.getCompanyName())
                        .domain(request.getDomain())
                        .type(mapper.toDomainInterviewType(request.getType()))
                        .round(mapper.toDomainInterviewRound(request.getRound()))
                        .roles(roles)
                        .scheduledDurationMinutes(request.getScheduledDurationMinutes())
                        .jobPostingUrl(request.getJobPostingUrl())
                        .selfIntroText(request.getSelfIntroText())
                        .build();

        CreateInterviewResult result = createInterviewUseCase.execute(command);
        CreateInterviewResponse response = buildResponse(result);

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    private CreateInterviewResponse buildResponse(CreateInterviewResult result) {
        InterviewSessionStatus status =
                result.getStatus() == null ? InterviewSessionStatus.READY : result.getStatus();
        return CreateInterviewResponse.newBuilder()
                .setInterviewId(result.getInterviewId().toString())
                .setStatus(mapper.toProtoInterviewStatus(status))
                .build();
    }

    private boolean hasResumeId(CreateInterviewRequest request) {
        return request.hasResumeId() && !request.getResumeId().isEmpty();
    }

    @Override
    public void listInterviews(
            ListInterviewsRequest request,
            StreamObserver<ListInterviewsResponse> responseObserver) {

        UUID userId = UUID.fromString(request.getUserId());
        List<InterviewSessionStatus> statuses =
                request.getStatusList().stream().map(mapper::toDomainInterviewStatus).toList();

        var command =
                ListInterviewsUseCase.ListInterviewsCommand.builder()
                        .userId(userId)
                        .status(statuses)
                        .limit(request.getLimit())
                        .sort(request.getSort())
                        .build();

        var summaries = listInterviewsUseCase.execute(command);

        ListInterviewsResponse.Builder responseBuilder = ListInterviewsResponse.newBuilder();

        responseBuilder.addAllInterviews(
                summaries.stream().map(mapper::toProtoInterviewSummary).toList());

        responseObserver.onNext(responseBuilder.build());
        responseObserver.onCompleted();
    }

    @Override
    public void getInterviewStage(
            GetInterviewStageRequest request,
            StreamObserver<GetInterviewStageResponse> responseObserver) {

        UUID interviewId = UUID.fromString(request.getInterviewId());
        GetInterviewStageQuery query = new GetInterviewStageQuery(interviewId);

        InterviewStageResult result = getInterviewStageUseCase.execute(query);

        GetInterviewStageResponse.Builder responseBuilder = GetInterviewStageResponse.newBuilder();

        if (result.stage() != null) {
            responseBuilder.setStage(mapper.toProtoInterviewStage(result.stage()));
        }
        if (result.participatingPersonas() != null) {
            responseBuilder.addAllParticipatingPersonas(result.participatingPersonas());
        }
        if (result.domain() != null) {
            responseBuilder.setDomain(result.domain());
        }
        responseBuilder.setSelfIntroRetryCount(result.selfIntroRetryCount());
        if (result.turnStatus() != null) {
            responseBuilder.setTurnStatus(mapper.toProtoTurnStatus(result.turnStatus()));
        }
        if (result.turnCount() != null) {
            responseBuilder.setTurnCount(result.turnCount());
        }
        if (result.activePersonaId() != null) {
            responseBuilder.setActivePersonaId(result.activePersonaId());
        }
        responseBuilder.setCanCandidateSpeak(result.canCandidateSpeak());

        responseObserver.onNext(responseBuilder.build());
        responseObserver.onCompleted();
    }

    @Override
    public void transitionStage(
            TransitionStageRequest request,
            StreamObserver<TransitionStageResponse> responseObserver) {

        UUID interviewId = UUID.fromString(request.getInterviewId());
        me.unbrdn.core.interview.domain.enums.InterviewStage newStage =
                mapper.toDomainInterviewStage(request.getNewStage());
        String newStageName = newStage.name();

        TransitionStageCommand command = new TransitionStageCommand(interviewId, newStageName);

        transitionInterviewStageUseCase.execute(command);

        GetInterviewStageQuery query = new GetInterviewStageQuery(interviewId);
        InterviewStageResult result = getInterviewStageUseCase.execute(query);

        TransitionStageResponse response =
                TransitionStageResponse.newBuilder().setCurrentStage(request.getNewStage()).build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void getInterviewHistory(
            GetInterviewHistoryRequest request,
            StreamObserver<GetInterviewHistoryResponse> responseObserver) {

        try {
            String interviewId = request.getInterviewId();
            log.info("gRPC getInterviewHistory called: interviewId={}", interviewId);

            var messages = getInterviewHistoryUseCase.execute(interviewId);

            var protoMessages = messages.stream().map(this::toProtoMessage).toList();

            GetInterviewHistoryResponse response =
                    GetInterviewHistoryResponse.newBuilder().addAllMessages(protoMessages).build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.error("Error in getInterviewHistory", e);
            responseObserver.onError(e);
        }
    }

    private InterviewMessage toProtoMessage(InterviewMessageDto dto) {
        return InterviewMessage.newBuilder()
                .setRole(dto.role())
                .setType(dto.type())
                .setContent(dto.content())
                .setTimestamp(dto.timestamp())
                .putAllPayload(dto.payload())
                .build();
    }

    @Override
    public void completeInterview(
            CompleteInterviewRequest request,
            StreamObserver<CompleteInterviewResponse> responseObserver) {

        try {
            UUID interviewId = UUID.fromString(request.getInterviewId());
            log.info("gRPC completeInterview called: interviewId={}", interviewId);

            me.unbrdn.core.interview.application.port.in.CompleteInterviewUseCase
                            .CompleteInterviewCommand
                    command =
                            new me.unbrdn.core.interview.application.port.in
                                    .CompleteInterviewUseCase.CompleteInterviewCommand(interviewId);
            me.unbrdn.core.interview.application.port.in.CompleteInterviewUseCase
                            .CompleteInterviewResult
                    result = completeInterviewUseCase.execute(command);

            CompleteInterviewResponse response =
                    CompleteInterviewResponse.newBuilder()
                            .setInterviewId(result.interviewId())
                            .setStatus(mapper.toProtoStatus(result.status()))
                            .setEndedAt(result.endedAt())
                            .build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.error("Error in completeInterview", e);
            responseObserver.onError(e);
        }
    }

    @Override
    public void cancelInterview(
            CancelInterviewRequest request,
            StreamObserver<CancelInterviewResponse> responseObserver) {

        try {
            UUID interviewId = UUID.fromString(request.getInterviewId());
            log.info(
                    "gRPC cancelInterview called: interviewId={}, reason={}",
                    interviewId,
                    request.getReason());

            me.unbrdn.core.interview.application.port.in.CancelInterviewUseCase
                            .CancelInterviewCommand
                    command =
                            new me.unbrdn.core.interview.application.port.in.CancelInterviewUseCase
                                    .CancelInterviewCommand(interviewId, request.getReason());
            me.unbrdn.core.interview.application.port.in.CancelInterviewUseCase
                            .CancelInterviewResult
                    result = cancelInterviewUseCase.execute(command);

            CancelInterviewResponse response =
                    CancelInterviewResponse.newBuilder()
                            .setInterviewId(result.interviewId())
                            .setStatus(mapper.toProtoStatus(result.status()))
                            .setEndedAt(result.endedAt())
                            .build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.error("Failed to cancel interview", e);
            io.grpc.Status status = GlobalGrpcExceptionHandler.toGrpcStatus(e);
            responseObserver.onError(status.asRuntimeException());
        }
    }

    @Override
    public void pauseInterview(
            PauseInterviewRequest request,
            StreamObserver<PauseInterviewResponse> responseObserver) {
        try {
            log.info("Received pauseInterview request: {}", request.getInterviewId());

            var command =
                    new me.unbrdn.core.interview.application.port.in.PauseInterviewUseCase
                            .PauseInterviewCommand(UUID.fromString(request.getInterviewId()));

            var result = pauseInterviewUseCase.execute(command);

            var response =
                    PauseInterviewResponse.newBuilder()
                            .setInterviewId(result.interviewId())
                            .setStatus(mapper.toProtoStatus(result.status()))
                            .setPausedAt(result.pausedAt() != null ? result.pausedAt() : "")
                            .build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();

            log.info("Interview paused successfully: {}", result.interviewId());
        } catch (Exception e) {
            log.error("Failed to pause interview", e);
            io.grpc.Status status = GlobalGrpcExceptionHandler.toGrpcStatus(e);
            responseObserver.onError(status.asRuntimeException());
        }
    }

    @Override
    public void resumeInterview(
            ResumeInterviewRequest request,
            StreamObserver<ResumeInterviewResponse> responseObserver) {
        try {
            log.info("Received resumeInterview request: {}", request.getInterviewId());

            var command =
                    new me.unbrdn.core.interview.application.port.in.ResumeInterviewUseCase
                            .ResumeInterviewCommand(UUID.fromString(request.getInterviewId()));

            var result = resumeInterviewUseCase.execute(command);

            var response =
                    ResumeInterviewResponse.newBuilder()
                            .setInterviewId(result.interviewId())
                            .setStatus(mapper.toProtoStatus(result.status()))
                            .setResumedAt(result.resumedAt() != null ? result.resumedAt() : "")
                            .build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();

            log.info("Interview resumed successfully: {}", result.interviewId());
        } catch (Exception e) {
            log.error("Failed to resume interview", e);
            io.grpc.Status status = GlobalGrpcExceptionHandler.toGrpcStatus(e);
            responseObserver.onError(status.asRuntimeException());
        }
    }

    @Override
    public void forceStage(
            me.unbrdn.core.grpc.interview.v1.ForceStageRequest request,
            StreamObserver<me.unbrdn.core.grpc.interview.v1.ForceStageResponse> responseObserver) {
        try {
            log.warn(
                    "[DevTool] Received forceStage request: interviewId={}, targetStage={}",
                    request.getInterviewId(),
                    request.getTargetStage());

            var command =
                    new me.unbrdn.core.interview.application.port.in.ForceStageCommand(
                            request.getInterviewId(), request.getTargetStage().name());

            var result = forceStageUseCase.execute(command);

            var response =
                    me.unbrdn.core.grpc.interview.v1.ForceStageResponse.newBuilder()
                            .setInterviewId(result.interviewId())
                            .setCurrentStage(mapper.toProtoStage(result.currentStage()))
                            .setMessage(result.message())
                            .build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();

            log.warn(
                    "[DevTool] Stage forcefully changed: interviewId={}, newStage={}",
                    result.interviewId(),
                    result.currentStage());
        } catch (Exception e) {
            log.error("[DevTool] Failed to force stage", e);
            io.grpc.Status status = GlobalGrpcExceptionHandler.toGrpcStatus(e);
            responseObserver.onError(status.asRuntimeException());
        }
    }

    @Override
    public void getInterview(
            me.unbrdn.core.grpc.interview.v1.GetInterviewRequest request,
            StreamObserver<me.unbrdn.core.grpc.interview.v1.GetInterviewResponse>
                    responseObserver) {
        try {
            UUID interviewId = UUID.fromString(request.getInterviewId());
            var query =
                    new me.unbrdn.core.interview.application.port.in.GetInterviewUseCase
                            .GetInterviewQuery(interviewId);
            var result = getInterviewUseCase.execute(query);

            var response = mapper.toProtoGetInterviewResponse(result);

            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.error("Failed to get interview", e);
            io.grpc.Status status = GlobalGrpcExceptionHandler.toGrpcStatus(e);
            responseObserver.onError(status.asRuntimeException());
        }
    }

    @Override
    public void createInterviewReport(
            CreateInterviewReportRequest request,
            StreamObserver<CreateInterviewReportResponse> responseObserver) {
        try {
            UUID interviewId = UUID.fromString(request.getInterviewId());
            var command = new CreateInterviewReportUseCase.CreateReportCommand(interviewId);
            var result = createInterviewReportUseCase.execute(command);

            CreateInterviewReportResponse response =
                    CreateInterviewReportResponse.newBuilder()
                            .setReportId(result.reportId().toString())
                            .setGenerationStatus(result.generationStatus().name())
                            .build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.error("Failed to create interview report", e);
            io.grpc.Status status = GlobalGrpcExceptionHandler.toGrpcStatus(e);
            responseObserver.onError(status.asRuntimeException());
        }
    }

    @Override
    public void getInterviewReport(
            GetInterviewReportRequest request,
            StreamObserver<GetInterviewReportResponse> responseObserver) {
        try {
            UUID interviewId = UUID.fromString(request.getInterviewId());
            UUID reportId = UUID.fromString(request.getReportId());
            var query = new GetInterviewReportUseCase.GetReportQuery(interviewId, reportId);
            var result = getInterviewReportUseCase.execute(query);

            GetInterviewReportResponse response =
                    GetInterviewReportResponse.newBuilder()
                            .setReportId(result.reportId().toString())
                            .setGenerationStatus(result.generationStatus().name())
                            .setTotalScore(result.totalScore())
                            .setPassFailStatus(result.passFailStatus().name())
                            .setSummaryText(
                                    result.summaryText() != null ? result.summaryText() : "")
                            .setResumeFeedback(
                                    result.resumeFeedback() != null ? result.resumeFeedback() : "")
                            .build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.error("Failed to get interview report", e);
            io.grpc.Status status = GlobalGrpcExceptionHandler.toGrpcStatus(e);
            responseObserver.onError(status.asRuntimeException());
        }
    }

    @Override
    public void getRecordingSegmentUploadUrl(
            GetRecordingSegmentUploadUrlRequest request,
            StreamObserver<GetRecordingSegmentUploadUrlResponse> responseObserver) {
        try {
            var command =
                    new GetUploadUrlForSegmentUseCase.GetUploadUrlCommand(
                            UUID.fromString(request.getInterviewId()), request.getTurnCount());
            var result = getUploadUrlForSegmentUseCase.execute(command);

            responseObserver.onNext(
                    GetRecordingSegmentUploadUrlResponse.newBuilder()
                            .setUploadUrl(result.uploadUrl())
                            .setObjectKey(result.objectKey())
                            .build());
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.error("Failed to get recording segment upload URL", e);
            responseObserver.onError(
                    GlobalGrpcExceptionHandler.toGrpcStatus(e).asRuntimeException());
        }
    }

    @Override
    public void completeRecordingSegmentUpload(
            CompleteRecordingSegmentUploadRequest request,
            StreamObserver<CompleteRecordingSegmentUploadResponse> responseObserver) {
        try {
            var command =
                    new CompleteSegmentUploadUseCase.CompleteSegmentCommand(
                            UUID.fromString(request.getInterviewId()),
                            request.getObjectKey(),
                            request.getTurnCount(),
                            request.getDurationSeconds() > 0 ? request.getDurationSeconds() : null,
                            request.getStartedAtEpoch() > 0
                                    ? java.time.Instant.ofEpochMilli(request.getStartedAtEpoch())
                                    : null,
                            request.getEndedAtEpoch() > 0
                                    ? java.time.Instant.ofEpochMilli(request.getEndedAtEpoch())
                                    : null);
            completeSegmentUploadUseCase.execute(command);

            responseObserver.onNext(
                    CompleteRecordingSegmentUploadResponse.newBuilder().setSuccess(true).build());
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.error("Failed to complete recording segment upload", e);
            responseObserver.onError(
                    GlobalGrpcExceptionHandler.toGrpcStatus(e).asRuntimeException());
        }
    }

    @Override
    public void getInterviewRecordingSegments(
            GetInterviewRecordingSegmentsRequest request,
            StreamObserver<GetInterviewRecordingSegmentsResponse> responseObserver) {
        try {
            var query =
                    new GetInterviewRecordingSegmentsUseCase.GetSegmentsQuery(
                            UUID.fromString(request.getInterviewId()));
            var results = getInterviewRecordingSegmentsUseCase.execute(query);

            var segments =
                    results.stream()
                            .map(
                                    r ->
                                            RecordingSegment.newBuilder()
                                                    .setTurnCount(r.turnCount())
                                                    .setRecordingUrl(
                                                            r.recordingUrl() != null
                                                                    ? r.recordingUrl()
                                                                    : "")
                                                    .setExpiresAtEpoch(r.expiresAtEpoch())
                                                    .setQuestionContent(
                                                            r.questionContent() != null
                                                                    ? r.questionContent()
                                                                    : "")
                                                    .setAnswerContent(
                                                            r.answerContent() != null
                                                                    ? r.answerContent()
                                                                    : "")
                                                    .setQuestionAudioUrl(
                                                            r.questionAudioUrl() != null
                                                                    ? r.questionAudioUrl()
                                                                    : "")
                                                    .setAnswerAudioUrl(
                                                            r.answerAudioUrl() != null
                                                                    ? r.answerAudioUrl()
                                                                    : "")
                                                    .build())
                            .toList();

            responseObserver.onNext(
                    GetInterviewRecordingSegmentsResponse.newBuilder()
                            .addAllSegments(segments)
                            .build());
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.error("Failed to get interview recording segments", e);
            responseObserver.onError(
                    GlobalGrpcExceptionHandler.toGrpcStatus(e).asRuntimeException());
        }
    }
}
