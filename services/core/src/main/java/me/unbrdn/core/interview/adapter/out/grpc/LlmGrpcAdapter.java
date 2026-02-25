package me.unbrdn.core.interview.adapter.out.grpc;

import io.grpc.Metadata;
import io.grpc.stub.MetadataUtils;
import io.grpc.stub.StreamObserver;
import java.util.Iterator;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.grpc.common.v1.InterviewPersonalityProto;
import me.unbrdn.core.grpc.common.v1.InterviewRoleProto;
import me.unbrdn.core.grpc.common.v1.InterviewStageProto;
import me.unbrdn.core.grpc.llm.v1.ConversationHistory;
import me.unbrdn.core.grpc.llm.v1.GenerateRequest;
import me.unbrdn.core.grpc.llm.v1.LlmServiceGrpc;
import me.unbrdn.core.grpc.llm.v1.TokenChunk;
import me.unbrdn.core.interview.application.dto.command.CallLlmCommand;
import me.unbrdn.core.interview.application.dto.command.ProcessLlmTokenCommand;
import me.unbrdn.core.interview.application.port.in.ProcessLlmTokenUseCase;
import me.unbrdn.core.interview.application.port.out.CallLlmPort;
import me.unbrdn.core.interview.domain.enums.InterviewPersonality;
import me.unbrdn.core.interview.domain.enums.InterviewRole;
import me.unbrdn.core.interview.domain.enums.InterviewStage;
import net.devh.boot.grpc.client.inject.GrpcClient;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class LlmGrpcAdapter implements CallLlmPort {

    @GrpcClient("llm-service")
    private LlmServiceGrpc.LlmServiceStub llmServiceStub;

    @GrpcClient("llm-service")
    private LlmServiceGrpc.LlmServiceBlockingStub llmServiceBlockingStub;

    private final ProcessLlmTokenUseCase processLlmTokenUseCase;

    @Override
    public void generateResponse(CallLlmCommand command) {
        // gRPC Metadata (interview-id) 추가
        Metadata metadata = new Metadata();
        metadata.put(
                Metadata.Key.of("interview-id", Metadata.ASCII_STRING_MARSHALLER),
                command.getInterviewId());

        LlmServiceGrpc.LlmServiceStub stubWithMetadata =
                llmServiceStub.withInterceptors(
                        MetadataUtils.newAttachHeadersInterceptor(metadata));

        GenerateRequest request = createGenerateRequest(command);

        // 스트리밍 응답 처리 (재시도 로직 포함)
        StreamObserver<TokenChunk> responseObserver =
                new LlmStreamObserver(command, stubWithMetadata, request, 0);

        // incoming gRPC Context가 종료되어도 LLM 스트리밍인 유지되도록 Root Context에서 실행
        io.grpc.Context.ROOT.run(
                () -> {
                    stubWithMetadata.generateResponse(request, responseObserver);
                });
    }

    @Override
    public void generateResponseSync(CallLlmCommand command) {
        // gRPC Metadata (interview-id) 추가
        Metadata metadata = new Metadata();
        metadata.put(
                Metadata.Key.of("interview-id", Metadata.ASCII_STRING_MARSHALLER),
                command.getInterviewId());

        LlmServiceGrpc.LlmServiceBlockingStub stubWithMetadata =
                llmServiceBlockingStub.withInterceptors(
                        MetadataUtils.newAttachHeadersInterceptor(metadata));

        GenerateRequest request = createGenerateRequest(command);

        try {
            Iterator<TokenChunk> responses = stubWithMetadata.generateResponse(request);
            while (responses.hasNext()) {
                TokenChunk chunk = responses.next();
                processChunk(chunk, command);
            }
            log.info("LLM gRPC sync stream completed: interviewId={}", command.getInterviewId());
        } catch (Exception e) {
            log.error("LLM gRPC sync stream error: interviewId={}", command.getInterviewId(), e);
        }
    }

    private GenerateRequest createGenerateRequest(CallLlmCommand command) {
        return GenerateRequest.newBuilder()
                .setInterviewId(command.getInterviewId())
                .setUserId(command.getUserId())
                .setUserText(command.getUserText())
                // .addAllAvailablePersonas(toProtoPersonas(command.getAvailablePersonas())) //
                // Deprecated
                .addAllAvailableRoles(toProtoRoles(command.getAvailableRoles()))
                .setPersonality(toProtoPersonality(command.getPersonality()))
                .addAllHistory(toProtoHistory(command.getHistory()))
                .setStage(toProtoInterviewStage(command.getStage()))
                .setInterviewerCount(command.getInterviewerCount())
                .setDomain(command.getDomain())
                .setTotalDurationSeconds(command.getTotalDurationSeconds())
                .setRemainingTimeSeconds(command.getRemainingTimeSeconds())
                .setCurrentDifficultyLevel(command.getCurrentDifficultyLevel())
                .setLastInterviewerId(
                        command.getLastInterviewerId() == null
                                ? "LEADER"
                                : command.getLastInterviewerId())
                .setInputRole(command.getInputRole() == null ? "user" : command.getInputRole())
                .build();
    }

    private void processChunk(TokenChunk chunk, CallLlmCommand command) {
        ProcessLlmTokenCommand tokenCommand =
                ProcessLlmTokenCommand.builder()
                        .interviewId(command.getInterviewId())
                        .userId(command.getUserId())
                        .userText(command.getUserText())
                        .token(chunk.getToken())
                        .thinking(chunk.getThinking())
                        .isSentenceEnd(chunk.getIsSentenceEnd())
                        .isFinal(chunk.getIsFinal())
                        .currentPersonaId(chunk.getCurrentPersonaId())
                        .nextDifficultyLevel(chunk.getNextDifficultyLevel())
                        .reduceTotalTime(chunk.getReduceTotalTime())
                        .interviewEndSignal(chunk.getInterviewEndSignal())
                        .mode(command.getMode())
                        .inputRole(command.getInputRole() == null ? "user" : command.getInputRole())
                        .build();

        processLlmTokenUseCase.execute(tokenCommand);
    }

    /*
     * private List<PersonaProfile> toProtoPersonas(List<InterviewPersona> personas)
     * { if (personas == null) return List.of(); return personas.stream().map(p ->
     * PersonaProfile.newBuilder().setId(p.name()).setName(p.getName())
     * .setRole(p.getRole()).setTone(p.getTone()).build()).collect(Collectors.toList
     * ()); }
     */

    private List<InterviewRoleProto> toProtoRoles(List<InterviewRole> roles) {
        if (roles == null) return List.of();
        return roles.stream().map(this::toProtoRole).collect(Collectors.toList());
    }

    private InterviewRoleProto toProtoRole(InterviewRole role) {
        return switch (role) {
            case TECH -> InterviewRoleProto.TECH;
            case HR -> InterviewRoleProto.HR;
            case LEADER -> InterviewRoleProto.LEADER;
        };
    }

    private InterviewPersonalityProto toProtoPersonality(InterviewPersonality personality) {
        if (personality == null) return InterviewPersonalityProto.INTERVIEW_PERSONALITY_UNSPECIFIED;
        return switch (personality) {
            case PRESSURE -> InterviewPersonalityProto.PRESSURE;
            case COMFORTABLE -> InterviewPersonalityProto.COMFORTABLE;
            case RANDOM -> InterviewPersonalityProto.RANDOM;
        };
    }

    private InterviewStageProto toProtoInterviewStage(InterviewStage stage) {
        if (stage == null) {
            return InterviewStageProto.IN_PROGRESS_STAGE;
        }
        switch (stage) {
            case GREETING:
                return InterviewStageProto.GREETING;
            case CANDIDATE_GREETING:
                return InterviewStageProto.CANDIDATE_GREETING;
            case INTERVIEWER_INTRO:
                return InterviewStageProto.INTERVIEWER_INTRO;
            case SELF_INTRO_PROMPT:
                return InterviewStageProto.SELF_INTRO_PROMPT;
            case SELF_INTRO:
                return InterviewStageProto.SELF_INTRO;
            case IN_PROGRESS:
                return InterviewStageProto.IN_PROGRESS_STAGE;
            case LAST_QUESTION_PROMPT:
                return InterviewStageProto.LAST_QUESTION_PROMPT;
            case LAST_ANSWER:
                return InterviewStageProto.LAST_ANSWER;
            case COMPLETED:
                return InterviewStageProto.COMPLETED_STAGE;
            default:
                return InterviewStageProto.IN_PROGRESS_STAGE;
        }
    }

    private List<ConversationHistory> toProtoHistory(
            List<me.unbrdn.core.interview.domain.model.ConversationHistory> history) {
        return history.stream()
                .map(
                        h ->
                                ConversationHistory.newBuilder()
                                        .setRole(h.getRole())
                                        .setContent(h.getContent())
                                        .build())
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

        public LlmStreamObserver(
                CallLlmCommand command,
                LlmServiceGrpc.LlmServiceStub stub,
                GenerateRequest request,
                int retryCount) {
            this.command = command;
            this.stub = stub;
            this.request = request;
            this.retryCount = retryCount;
        }

        @Override
        public void onNext(TokenChunk chunk) {
            processChunk(chunk, command);
        }

        @Override
        public void onError(Throwable t) {
            log.error(
                    "LLM gRPC stream error: interviewId={}, retryCount={}",
                    command.getInterviewId(),
                    retryCount,
                    t);

            if (retryCount < MAX_RETRIES) {
                long backoffMs = INITIAL_BACKOFF_MS * (long) Math.pow(2, retryCount);
                log.info("Retrying LLM gRPC stream in {}ms...", backoffMs);

                try {
                    TimeUnit.MILLISECONDS.sleep(backoffMs);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                }

                StreamObserver<TokenChunk> nextObserver =
                        new LlmStreamObserver(command, stub, request, retryCount + 1);
                stub.generateResponse(request, nextObserver);
            } else {
                log.error(
                        "Max retries reached for LLM gRPC stream: interviewId={}",
                        command.getInterviewId());
            }
        }

        @Override
        public void onCompleted() {
            log.info("LLM gRPC stream completed: interviewId={}", command.getInterviewId());
        }
    }
}
