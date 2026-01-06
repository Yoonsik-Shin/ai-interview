package me.unbrdn.core.grpc;

import me.unbrdn.core.service.InterviewService;
import me.unbrdn.core.grpc.InterviewProto.CreateInterviewRequest;
import me.unbrdn.core.grpc.InterviewProto.CreateInterviewResponse;
import me.unbrdn.core.grpc.InterviewProto.InterviewStatusProto;

import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.devh.boot.grpc.server.service.GrpcService;

@Slf4j
@GrpcService // 🔥 이 어노테이션이 붙으면 Spring Boot가 gRPC 서비스로 인식하고 등록합니다.
@RequiredArgsConstructor
// 자동 생성된 Base 클래스를 상속받습니다.
public class GrpcInterviewService extends InterviewServiceGrpcGrpc.InterviewServiceGrpcImplBase {

  private final InterviewService interviewService; // 기존 비즈니스 로직 서비스 주입

  @Override
  public void createInterview(CreateInterviewRequest request,
      StreamObserver<CreateInterviewResponse> responseObserver) {
    log.info("gRPC 요청 수신: CreateInterview - userId={}", request.getUserId());

    try {
      // 1. 비즈니스 로직 실행 (DB 저장)
      // gRPC 요청 객체를 그대로 넘기고, 변환/검증은 서비스 계층에서 처리
      Long interviewId = interviewService.createInterview(request);

      // 2. 응답 생성
      CreateInterviewResponse response = CreateInterviewResponse.newBuilder().setInterviewId(interviewId)
          // 초기 상태는 READY로 고정 (필요시 도메인에서 리턴받아 매핑)
          .setStatus(InterviewStatusProto.READY).build();

      // 3. 응답 전송 및 완료 신호
      responseObserver.onNext(response);
      responseObserver.onCompleted();
      log.info("gRPC 응답 전송 완료: interviewId={}", interviewId);

    } catch (Exception e) {
      log.error("gRPC 처리 중 오류 발생", e);
      // gRPC 표준 에러로 변환해서 전달
      responseObserver
          .onError(io.grpc.Status.INTERNAL.withDescription("면접 생성 중 오류 발생: " + e.getMessage()).asRuntimeException());
    }
  }
}