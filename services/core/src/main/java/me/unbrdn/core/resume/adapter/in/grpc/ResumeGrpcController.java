package me.unbrdn.core.resume.adapter.in.grpc;

import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.grpc.ResumeProto.UploadResumeRequest;
import me.unbrdn.core.grpc.ResumeProto.UploadResumeResponse;
import me.unbrdn.core.grpc.ResumeServiceGrpc.ResumeServiceImplBase;
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

    private final UploadResumeUseCase uploadResumeUseCase;

    @Override
    public void uploadResume(
            UploadResumeRequest request, StreamObserver<UploadResumeResponse> responseObserver) {
        // TODO 디버깅용 삭제 필요
        log.info(
                "gRPC 요청 수신: UploadResume - userId={}, fileName={}",
                request.getUserId(),
                request.getFileName());

        UploadResumeCommand command =
                UploadResumeCommand.builder()
                        .userId(java.util.UUID.fromString(request.getUserId()))
                        .title(request.getTitle())
                        .fileData(request.getFileData().toByteArray())
                        .fileName(request.getFileName())
                        .contentType(request.getContentType())
                        .build();

        java.util.UUID resumeId = uploadResumeUseCase.execute(command);

        UploadResumeResponse response =
                UploadResumeResponse.newBuilder().setResumeId(resumeId.toString()).build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();

        // TODO 디버깅용 삭제 필요
        log.info("gRPC 응답 전송 완료: resumeId={}", resumeId);
    }
}
