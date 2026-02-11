package me.unbrdn.core.resume.adapter.in.grpc;

import io.grpc.stub.StreamObserver;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.grpc.ResumeProto.CompleteUploadRequest;
import me.unbrdn.core.grpc.ResumeProto.CompleteUploadResponse;
import me.unbrdn.core.grpc.ResumeProto.DeleteResumeRequest;
import me.unbrdn.core.grpc.ResumeProto.DeleteResumeResponse;
import me.unbrdn.core.grpc.ResumeProto.GetResumeRequest;
import me.unbrdn.core.grpc.ResumeProto.GetResumeResponse;
import me.unbrdn.core.grpc.ResumeProto.GetUploadUrlRequest;
import me.unbrdn.core.grpc.ResumeProto.GetUploadUrlResponse;
import me.unbrdn.core.grpc.ResumeProto.ListResumesRequest;
import me.unbrdn.core.grpc.ResumeProto.ListResumesResponse;
import me.unbrdn.core.grpc.ResumeProto.ResumeDetail;
import me.unbrdn.core.grpc.ResumeProto.ResumeItem;
import me.unbrdn.core.grpc.ResumeProto.UploadResumeRequest;
import me.unbrdn.core.grpc.ResumeProto.UploadResumeResponse;
import me.unbrdn.core.grpc.ResumeServiceGrpc.ResumeServiceImplBase;
import me.unbrdn.core.resume.application.dto.CompleteUploadCommand;
import me.unbrdn.core.resume.application.dto.GetUploadUrlCommand;
import me.unbrdn.core.resume.application.dto.GetUploadUrlResult;
import me.unbrdn.core.resume.application.port.in.CompleteUploadUseCase;
import me.unbrdn.core.resume.application.port.in.DeleteResumeUseCase;
import me.unbrdn.core.resume.application.port.in.GetResumeUseCase;
import me.unbrdn.core.resume.application.port.in.GetUploadUrlUseCase;
import me.unbrdn.core.resume.application.port.in.ListResumesByUserUseCase;
import me.unbrdn.core.resume.application.port.in.UploadResumeUseCase;
import me.unbrdn.core.resume.application.service.UploadResumeCommand;
import net.devh.boot.grpc.server.service.GrpcService;

/**
 * Resume gRPC Controller
 *
 * <p>Input Adapter: gRPC 요청을 받아 Application Layer의 UseCase를 호출합니다.
 */
@Slf4j
@GrpcService
@RequiredArgsConstructor
public class ResumeGrpcController extends ResumeServiceImplBase {

    private final GetUploadUrlUseCase getUploadUrlUseCase;
    private final CompleteUploadUseCase completeUploadUseCase;
    private final UploadResumeUseCase uploadResumeUseCase;
    private final me.unbrdn.core.resume.application.port.in.UpdateResumeUseCase updateResumeUseCase;
    private final ListResumesByUserUseCase listResumesByUserUseCase;
    private final GetResumeUseCase getResumeUseCase;
    private final DeleteResumeUseCase deleteResumeUseCase;
    private final me.unbrdn.core.resume.application.port.in.GetResumeEmbeddingsUseCase
            getResumeEmbeddingsUseCase;

    @Override
    public void getUploadUrl(
            GetUploadUrlRequest request, StreamObserver<GetUploadUrlResponse> responseObserver) {
        log.info(
                "gRPC 요청 수신: GetUploadUrl - userId={}, fileName={}",
                request.getUserId(),
                request.getFileName());

        GetUploadUrlCommand command =
                GetUploadUrlCommand.builder()
                        .userId(UUID.fromString(request.getUserId()))
                        .fileName(request.getFileName())
                        .title(request.getTitle())
                        .build();

        GetUploadUrlResult result = getUploadUrlUseCase.execute(command);

        GetUploadUrlResponse response =
                GetUploadUrlResponse.newBuilder()
                        .setUploadUrl(result.getUploadUrl())
                        .setResumeId(result.getResumeId())
                        .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void completeUpload(
            CompleteUploadRequest request,
            StreamObserver<CompleteUploadResponse> responseObserver) {
        log.info("gRPC 요청 수신: CompleteUpload - resumeId={}", request.getResumeId());
        try {
            CompleteUploadCommand command =
                    CompleteUploadCommand.builder()
                            .resumeId(UUID.fromString(request.getResumeId()))
                            .validationText(request.getValidationText())
                            .embedding(floatsToArray(request.getEmbeddingList()))
                            .build();

            completeUploadUseCase.execute(command);

            CompleteUploadResponse response =
                    CompleteUploadResponse.newBuilder().setSuccess(true).build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.error("gRPC 에러 (completeUpload): ", e);
            responseObserver.onError(
                    me.unbrdn.core.common.infrastructure.grpc.GlobalGrpcExceptionHandler
                            .toGrpcStatus(e)
                            .asRuntimeException());
        }
    }

    @Override
    public void uploadResume(
            UploadResumeRequest request, StreamObserver<UploadResumeResponse> responseObserver) {
        log.info(
                "gRPC 요청 수신(Legacy): UploadResume - userId={}, fileName={}",
                request.getUserId(),
                request.getFileName());
        try {
            UploadResumeCommand command =
                    UploadResumeCommand.builder()
                            .userId(java.util.UUID.fromString(request.getUserId()))
                            .title(request.getTitle())
                            .fileData(request.getFileData().toByteArray())
                            .fileName(request.getFileName())
                            .contentType(request.getContentType())
                            .forceUpload(request.getForceUpload())
                            .validationText(request.getValidationText())
                            .embedding(floatsToArray(request.getEmbeddingList()))
                            .build();

            me.unbrdn.core.resume.application.dto.UploadResumeResult result =
                    uploadResumeUseCase.execute(command);

            UploadResumeResponse.Builder responseBuilder = UploadResumeResponse.newBuilder();

            if (result.isHasSimilarResume()) {
                // 유사 이력서 발견 - SimilarResumeInfo 반환
                var similarResume = result.getSimilarResume();
                responseBuilder.setSimilarResume(
                        me.unbrdn.core.grpc.ResumeProto.SimilarResumeInfo.newBuilder()
                                .setExistingResumeId(similarResume.resumeId())
                                .setSimilarity(similarResume.similarity())
                                .setTitle(similarResume.title())
                                .setUploadedAt(similarResume.uploadedAt())
                                .build());
                log.info(
                        "유사 이력서 발견 응답: userId={}, existingResumeId={}, similarity={}",
                        request.getUserId(),
                        similarResume.resumeId(),
                        similarResume.similarity());
            } else {
                // 정상 업로드 성공 - resumeId 반환
                responseBuilder.setResumeId(result.getResumeId());
                log.info("gRPC 응답 전송 완료: resumeId={}", result.getResumeId());
            }

            responseObserver.onNext(responseBuilder.build());
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.error("gRPC 에러 (uploadResume): ", e);
            responseObserver.onError(
                    me.unbrdn.core.common.infrastructure.grpc.GlobalGrpcExceptionHandler
                            .toGrpcStatus(e)
                            .asRuntimeException());
        }
    }

    @Override
    public void updateResume(
            me.unbrdn.core.grpc.ResumeProto.UpdateResumeRequest request,
            StreamObserver<me.unbrdn.core.grpc.ResumeProto.UpdateResumeResponse> responseObserver) {
        log.info(
                "gRPC 요청 수신: UpdateResume - userId={}, existingResumeId={}",
                request.getUserId(),
                request.getExistingResumeId());
        try {
            me.unbrdn.core.resume.application.service.UpdateResumeCommand command =
                    me.unbrdn.core.resume.application.service.UpdateResumeCommand.builder()
                            .userId(UUID.fromString(request.getUserId()))
                            .existingResumeId(UUID.fromString(request.getExistingResumeId()))
                            .title(request.getTitle())
                            .fileData(request.getFileData().toByteArray())
                            .fileName(request.getFileName())
                            .contentType(request.getContentType())
                            .embedding(floatsToArray(request.getEmbeddingList()))
                            .build();

            UUID resumeId = updateResumeUseCase.execute(command);

            me.unbrdn.core.grpc.ResumeProto.UpdateResumeResponse response =
                    me.unbrdn.core.grpc.ResumeProto.UpdateResumeResponse.newBuilder()
                            .setResumeId(resumeId.toString())
                            .build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();

            log.info("gRPC 응답 전송 완료: resumeId={}", resumeId);
        } catch (Exception e) {
            log.error("gRPC 에러 (updateResume): ", e);
            responseObserver.onError(
                    me.unbrdn.core.common.infrastructure.grpc.GlobalGrpcExceptionHandler
                            .toGrpcStatus(e)
                            .asRuntimeException());
        }
    }

    @Override
    public void listResumes(
            ListResumesRequest request, StreamObserver<ListResumesResponse> responseObserver) {
        log.info("gRPC 요청 수신: ListResumes - userId={}", request.getUserId());

        java.util.List<me.unbrdn.core.resume.application.dto.ResumeItemDto> items =
                listResumesByUserUseCase.execute(UUID.fromString(request.getUserId()));

        ListResumesResponse.Builder responseBuilder = ListResumesResponse.newBuilder();
        for (me.unbrdn.core.resume.application.dto.ResumeItemDto dto : items) {
            responseBuilder.addResumes(
                    ResumeItem.newBuilder()
                            .setId(dto.getId().toString())
                            .setTitle(dto.getTitle())
                            .setStatus(dto.getStatus())
                            .setCreatedAt(
                                    dto.getCreatedAt() != null ? dto.getCreatedAt().toString() : "")
                            .build());
        }

        responseObserver.onNext(responseBuilder.build());
        responseObserver.onCompleted();
    }

    @Override
    public void getResume(
            GetResumeRequest request, StreamObserver<GetResumeResponse> responseObserver) {
        log.info(
                "gRPC 요청 수신: GetResume - resumeId={}, userId={}",
                request.getResumeId(),
                request.getUserId());

        java.util.Optional<me.unbrdn.core.resume.application.dto.ResumeDetailDto> opt =
                getResumeUseCase.execute(
                        UUID.fromString(request.getResumeId()),
                        UUID.fromString(request.getUserId()));

        if (opt.isEmpty()) {
            responseObserver.onNext(GetResumeResponse.newBuilder().build());
            responseObserver.onCompleted();
            return;
        }

        me.unbrdn.core.resume.application.dto.ResumeDetailDto dto = opt.get();
        ResumeDetail detail =
                ResumeDetail.newBuilder()
                        .setId(dto.getId().toString())
                        .setTitle(dto.getTitle())
                        .setContent(dto.getContent() != null ? dto.getContent() : "")
                        .setStatus(dto.getStatus())
                        .setCreatedAt(
                                dto.getCreatedAt() != null ? dto.getCreatedAt().toString() : "")
                        .setFileUrl(dto.getFileUrl() != null ? dto.getFileUrl() : "")
                        .build();

        responseObserver.onNext(GetResumeResponse.newBuilder().setResume(detail).build());
        responseObserver.onCompleted();
    }

    @Override
    public void deleteResume(
            DeleteResumeRequest request, StreamObserver<DeleteResumeResponse> responseObserver) {
        log.info(
                "gRPC 요청 수신: DeleteResume - resumeId={}, userId={}",
                request.getResumeId(),
                request.getUserId());

        boolean success =
                deleteResumeUseCase.deleteResume(request.getResumeId(), request.getUserId());

        DeleteResumeResponse response =
                DeleteResumeResponse.newBuilder().setSuccess(success).build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void getResumeEmbeddings(
            me.unbrdn.core.grpc.ResumeProto.GetResumeEmbeddingsRequest request,
            io.grpc.stub.StreamObserver<me.unbrdn.core.grpc.ResumeProto.GetResumeEmbeddingsResponse>
                    responseObserver) {
        log.info("gRPC 요청 수신: GetResumeEmbeddings - userId={}", request.getUserId());
        try {
            java.util.Map<UUID, float[]> embeddings =
                    getResumeEmbeddingsUseCase.execute(UUID.fromString(request.getUserId()));

            me.unbrdn.core.grpc.ResumeProto.GetResumeEmbeddingsResponse.Builder responseBuilder =
                    me.unbrdn.core.grpc.ResumeProto.GetResumeEmbeddingsResponse.newBuilder();

            log.info("조회된 임베딩 개수: {}", embeddings.size());

            embeddings.forEach(
                    (resumeId, vector) -> {
                        // log.debug("Embedding for resume {}: vector size {}", resumeId,
                        // vector.length);
                        me.unbrdn.core.grpc.ResumeProto.ResumeEmbedding.Builder embeddingBuilder =
                                me.unbrdn.core.grpc.ResumeProto.ResumeEmbedding.newBuilder()
                                        .setResumeId(resumeId.toString());
                        for (float v : vector) {
                            embeddingBuilder.addVector(v);
                        }
                        responseBuilder.addEmbeddings(embeddingBuilder.build());
                    });

            responseObserver.onNext(responseBuilder.build());
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.error("gRPC 에러 (GetResumeEmbeddings): ", e);
            responseObserver.onError(e);
        }
    }

    private float[] floatsToArray(java.util.List<Float> list) {
        if (list == null || list.isEmpty()) return null;
        float[] array = new float[list.size()];
        for (int i = 0; i < list.size(); i++) {
            array[i] = list.get(i);
        }
        return array;
    }
}
