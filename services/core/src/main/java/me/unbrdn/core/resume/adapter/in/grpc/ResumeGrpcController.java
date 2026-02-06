package me.unbrdn.core.resume.adapter.in.grpc;

import io.grpc.stub.StreamObserver;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.grpc.ResumeProto.CompleteUploadRequest;
import me.unbrdn.core.grpc.ResumeProto.CompleteUploadResponse;
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
import me.unbrdn.core.resume.application.port.in.GetResumeUseCase;
import me.unbrdn.core.resume.application.port.in.GetUploadUrlUseCase;
import me.unbrdn.core.resume.application.port.in.ListResumesByUserUseCase;
import me.unbrdn.core.resume.application.port.in.UploadResumeUseCase;
import me.unbrdn.core.resume.application.service.UploadResumeCommand;
import net.devh.boot.grpc.server.service.GrpcService;

/**
 * Resume gRPC Controller
 *
 * <p>
 * Input Adapter: gRPC 요청을 받아 Application Layer의 UseCase를 호출합니다.
 */
@Slf4j
@GrpcService
@RequiredArgsConstructor
public class ResumeGrpcController extends ResumeServiceImplBase {

    private final GetUploadUrlUseCase getUploadUrlUseCase;
    private final CompleteUploadUseCase completeUploadUseCase;
    private final UploadResumeUseCase uploadResumeUseCase;
    private final ListResumesByUserUseCase listResumesByUserUseCase;
    private final GetResumeUseCase getResumeUseCase;

    @Override
    public void getUploadUrl(GetUploadUrlRequest request, StreamObserver<GetUploadUrlResponse> responseObserver) {
        log.info("gRPC 요청 수신: GetUploadUrl - userId={}, fileName={}", request.getUserId(), request.getFileName());

        GetUploadUrlCommand command = GetUploadUrlCommand.builder().userId(UUID.fromString(request.getUserId()))
                .fileName(request.getFileName()).title(request.getTitle()).build();

        GetUploadUrlResult result = getUploadUrlUseCase.execute(command);

        GetUploadUrlResponse response = GetUploadUrlResponse.newBuilder().setUploadUrl(result.getUploadUrl())
                .setResumeId(result.getResumeId()).build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void completeUpload(CompleteUploadRequest request, StreamObserver<CompleteUploadResponse> responseObserver) {
        log.info("gRPC 요청 수신: CompleteUpload - resumeId={}", request.getResumeId());

        CompleteUploadCommand command = CompleteUploadCommand.builder().resumeId(UUID.fromString(request.getResumeId()))
                .build();

        completeUploadUseCase.execute(command);

        CompleteUploadResponse response = CompleteUploadResponse.newBuilder().setSuccess(true).build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void uploadResume(UploadResumeRequest request, StreamObserver<UploadResumeResponse> responseObserver) {
        // TODO 디버깅용 삭제 필요
        log.info("gRPC 요청 수신(Legacy): UploadResume - userId={}, fileName={}", request.getUserId(),
                request.getFileName());

        UploadResumeCommand command = UploadResumeCommand.builder()
                .userId(java.util.UUID.fromString(request.getUserId())).title(request.getTitle())
                .fileData(request.getFileData().toByteArray()).fileName(request.getFileName())
                .contentType(request.getContentType()).build();

        java.util.UUID resumeId = uploadResumeUseCase.execute(command);

        UploadResumeResponse response = UploadResumeResponse.newBuilder().setResumeId(resumeId.toString()).build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();

        // TODO 디버깅용 삭제 필요
        log.info("gRPC 응답 전송 완료: resumeId={}", resumeId);
    }

    @Override
    public void listResumes(ListResumesRequest request,
            StreamObserver<ListResumesResponse> responseObserver) {
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
                            .setCreatedAt(dto.getCreatedAt() != null ? dto.getCreatedAt().toString() : "")
                            .build());
        }

        responseObserver.onNext(responseBuilder.build());
        responseObserver.onCompleted();
    }

    @Override
    public void getResume(GetResumeRequest request, StreamObserver<GetResumeResponse> responseObserver) {
        log.info("gRPC 요청 수신: GetResume - resumeId={}, userId={}", request.getResumeId(),
                request.getUserId());

        java.util.Optional<me.unbrdn.core.resume.application.dto.ResumeDetailDto> opt =
                getResumeUseCase.execute(UUID.fromString(request.getResumeId()),
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
                        .setCreatedAt(dto.getCreatedAt() != null ? dto.getCreatedAt().toString() : "")
                        .build();

        responseObserver.onNext(GetResumeResponse.newBuilder().setResume(detail).build());
        responseObserver.onCompleted();
    }
}
