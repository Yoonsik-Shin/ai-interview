package me.unbrdn.core.resume.adapter.out.llm;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.grpc.llm.LlmProto.ClassifyResumeRequest;
import me.unbrdn.core.grpc.llm.LlmProto.ClassifyResumeResponse;
import me.unbrdn.core.grpc.llm.LlmServiceGrpc;
import me.unbrdn.core.resume.application.dto.ValidateResumeResult;
import me.unbrdn.core.resume.application.port.out.ValidateResumePort;
import net.devh.boot.grpc.client.inject.GrpcClient;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class LlmResumeAdapter implements ValidateResumePort {

    @GrpcClient("llm-service")
    private LlmServiceGrpc.LlmServiceBlockingStub llmServiceBlockingStub;

    @Override
    public ValidateResumeResult validateResume(String text) {
        log.info("LLM gRPC 호출: ClassifyResume");

        ClassifyResumeRequest request = ClassifyResumeRequest.newBuilder().setText(text).build();

        try {
            ClassifyResumeResponse response = llmServiceBlockingStub.classifyResume(request);

            return ValidateResumeResult.builder()
                    .isResume(response.getIsResume())
                    .reason(response.getReason())
                    .score(response.getScore())
                    .build();
        } catch (Exception e) {
            log.error("LLM gRPC 호출 중 에기치 못한 에러 발생: ", e);
            throw new RuntimeException("이력서 판별 중 오류가 발생했습니다.", e);
        }
    }
}
