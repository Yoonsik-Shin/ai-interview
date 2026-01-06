package com.example.core.resume.adapter.in.grpc;

import com.example.core.adapter.in.grpc.GlobalGrpcExceptionHandler;
import com.example.core.grpc.ResumeProto.UploadResumeRequest;
import com.example.core.grpc.ResumeProto.UploadResumeResponse;
import com.example.core.grpc.ResumeServiceGrpc.ResumeServiceImplBase;
import com.example.core.resume.application.port.in.UploadResumeUseCase;
import com.example.core.resume.application.service.UploadResumeCommand;

import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.devh.boot.grpc.server.service.GrpcService;

/**
 * Resume gRPC Controller
 * 
 * Input Adapter: gRPC 요청을 받아 Application Layer의 UseCase를 호출합니다.
 */
@Slf4j
@GrpcService
@RequiredArgsConstructor
public class ResumeGrpcController extends ResumeServiceImplBase {

  private final UploadResumeUseCase uploadResumeUseCase;

  @Override
  public void uploadResume(UploadResumeRequest request, StreamObserver<UploadResumeResponse> responseObserver) {
    log.info("gRPC 요청 수신: UploadResume - userId={}, fileName={}", request.getUserId(), request.getFileName());

    try {
      // 1. Command 생성
      UploadResumeCommand command = UploadResumeCommand.builder().userId(request.getUserId()).title(request.getTitle())
          .fileData(request.getFileData().toByteArray()).fileName(request.getFileName())
          .contentType(request.getContentType()).build();

      // 2. UseCase 실행
      Long resumeId = uploadResumeUseCase.execute(command);

      // 3. 응답 생성 및 전송
      UploadResumeResponse response = UploadResumeResponse.newBuilder().setResumeId(resumeId).build();

      responseObserver.onNext(response);
      responseObserver.onCompleted();
      log.info("gRPC 응답 전송 완료: resumeId={}", resumeId);

    } catch (Exception e) {
      io.grpc.Status status = GlobalGrpcExceptionHandler.toGrpcStatus(e);
      responseObserver.onError(status.asRuntimeException());
    }
  }
}
