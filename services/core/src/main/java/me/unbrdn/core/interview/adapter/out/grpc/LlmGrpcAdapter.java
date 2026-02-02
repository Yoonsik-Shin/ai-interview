package me.unbrdn.core.interview.adapter.out.grpc;

import io.grpc.Metadata;
import io.grpc.stub.MetadataUtils;
import io.grpc.stub.StreamObserver;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.grpc.llm.LlmProto.ConversationHistory;
import me.unbrdn.core.grpc.llm.LlmProto.GenerateRequest;
import me.unbrdn.core.grpc.llm.LlmProto.TokenChunk;
import me.unbrdn.core.grpc.llm.LlmServiceGrpc;
import me.unbrdn.core.interview.application.dto.command.CallLlmCommand;
import me.unbrdn.core.interview.application.dto.command.ProcessLlmTokenCommand;
import me.unbrdn.core.interview.application.port.in.ProcessLlmTokenUseCase;
import me.unbrdn.core.interview.application.port.out.CallLlmPort;
import net.devh.boot.grpc.client.inject.GrpcClient;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class LlmGrpcAdapter implements CallLlmPort {

    @GrpcClient("llm-service")
    private LlmServiceGrpc.LlmServiceStub llmServiceStub;

    private final ProcessLlmTokenUseCase processLlmTokenUseCase;

    @Override
    public void generateResponse(CallLlmCommand command) {
        // gRPC Metadata (session-id) 추가
        Metadata metadata = new Metadata();
        metadata.put(Metadata.Key.of("session-id", Metadata.ASCII_STRING_MARSHALLER), command.getInterviewId());

        LlmServiceGrpc.LlmServiceStub stubWithMetadata = llmServiceStub
                .withInterceptors(MetadataUtils.newAttachHeadersInterceptor(metadata));

        // gRPC Request 생성
        GenerateRequest request = GenerateRequest.newBuilder().setInterviewId(command.getInterviewId())
                .setUserId(command.getUserId()).setUserText(command.getUserText()).setPersona(command.getPersona())
                .addAllHistory(toProtoHistory(command.getHistory())).setStage(toProtoInterviewStage(command.getStage()))
                .setInterviewerCount(command.getInterviewerCount()).setDomain(command.getDomain()).build();

        // 스트리밍 응답 처리 (재시도 로직 포함)
        StreamObserver<TokenChunk> responseObserver = new LlmStreamObserver(command, stubWithMetadata, request, 0);

        // incoming gRPC Context가 종료되어도 LLM 스트리밍인 유지되도록 Root Context에서 실행
        io.grpc.Context.ROOT.run(() -> {
            stubWithMetadata.generateResponse(request, responseObserver);
        });
    }

    private me.unbrdn.core.grpc.llm.LlmProto.InterviewStageProto toProtoInterviewStage(
            me.unbrdn.core.interview.domain.enums.InterviewStage stage) {
        if (stage == null) {
            return me.unbrdn.core.grpc.llm.LlmProto.InterviewStageProto.IN_PROGRESS_STAGE;
        }
        switch (stage) {
        case GREETING:
            return me.unbrdn.core.grpc.llm.LlmProto.InterviewStageProto.GREETING;
        case INTERVIEWER_INTRO:
            return me.unbrdn.core.grpc.llm.LlmProto.InterviewStageProto.INTERVIEWER_INTRO;
        case SELF_INTRO:
            return me.unbrdn.core.grpc.llm.LlmProto.InterviewStageProto.SELF_INTRO;
        case IN_PROGRESS:
            return me.unbrdn.core.grpc.llm.LlmProto.InterviewStageProto.IN_PROGRESS_STAGE;
        case COMPLETED:
            return me.unbrdn.core.grpc.llm.LlmProto.InterviewStageProto.COMPLETED_STAGE;
        default:
            return me.unbrdn.core.grpc.llm.LlmProto.InterviewStageProto.IN_PROGRESS_STAGE;
        }
    }

    private List<ConversationHistory> toProtoHistory(
            List<me.unbrdn.core.interview.domain.model.ConversationHistory> history) {
        return history.stream()
                .map(h -> ConversationHistory.newBuilder().setRole(h.getRole()).setContent(h.getContent()).build())
                .collect(Collectors.toList());
    }

    /** LLM 스트리밍 응답 Observer Proto → Command 변환만 수행하고 Use Case로 위임 */
    private class LlmStreamObserver implements StreamObserver<TokenChunk> {
        private final CallLlmCommand command;
        private final LlmServiceGrpc.LlmServiceStub stub;
        private final GenerateRequest request;
        private final int retryCount;
        private static final int MAX_RETRIES = 3;
        private static final long INITIAL_BACKOFF_MS = 1000;

        public LlmStreamObserver(CallLlmCommand command, LlmServiceGrpc.LlmServiceStub stub, GenerateRequest request,
                int retryCount) {
            this.command = command;
            this.stub = stub;
            this.request = request;
            this.retryCount = retryCount;
        }

        @Override
        public void onNext(TokenChunk chunk) {
            // Proto → Command 변환
            ProcessLlmTokenCommand tokenCommand = ProcessLlmTokenCommand.builder().interviewId(command.getInterviewId())
                    .userId(command.getUserId()).userText(command.getUserText()).token(chunk.getToken())
                    .thinking(chunk.getThinking()).isSentenceEnd(chunk.getIsSentenceEnd()).isFinal(chunk.getIsFinal())
                    .persona(command.getPersona()).mode(command.getMode()).build();

            // Use Case로 위임
            processLlmTokenUseCase.execute(tokenCommand);
        }

        @Override
        public void onError(Throwable t) {
            log.error("LLM gRPC stream error: interviewId={}, retryCount={}", command.getInterviewId(), retryCount, t);

            if (retryCount < MAX_RETRIES) {
                long backoffMs = INITIAL_BACKOFF_MS * (long) Math.pow(2, retryCount);
                log.info("Retrying LLM gRPC stream in {}ms...", backoffMs);

                try {
                    TimeUnit.MILLISECONDS.sleep(backoffMs);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                }

                StreamObserver<TokenChunk> nextObserver = new LlmStreamObserver(command, stub, request, retryCount + 1);
                stub.generateResponse(request, nextObserver);
            } else {
                log.error("Max retries reached for LLM gRPC stream: interviewId={}", command.getInterviewId());
            }
        }

        @Override
        public void onCompleted() {
            log.info("LLM gRPC stream completed: interviewId={}", command.getInterviewId());
        }
    }
}
