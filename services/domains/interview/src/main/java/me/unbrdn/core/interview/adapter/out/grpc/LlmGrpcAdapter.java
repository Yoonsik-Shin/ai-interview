package me.unbrdn.core.interview.adapter.out.grpc;

import io.grpc.Metadata;
import io.grpc.stub.MetadataUtils;
import io.grpc.stub.StreamObserver;
import java.util.Iterator;
import java.util.List;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.grpc.common.v1.InterviewStageProto;
import me.unbrdn.core.grpc.llm.v1.GenerateReportRequest;
import me.unbrdn.core.grpc.llm.v1.GenerateReportResponse;
import me.unbrdn.core.grpc.llm.v1.GenerateRequest;
import me.unbrdn.core.grpc.llm.v1.LlmServiceGrpc;
import me.unbrdn.core.grpc.llm.v1.ReportMessage;
import me.unbrdn.core.grpc.llm.v1.TokenChunk;
import me.unbrdn.core.interview.adapter.out.persistence.entity.InterviewMessageJpaEntity;
import me.unbrdn.core.interview.application.dto.command.CallLlmCommand;
import me.unbrdn.core.interview.application.dto.command.ProcessLlmTokenCommand;
import me.unbrdn.core.interview.application.dto.result.GenerateReportResult;
import me.unbrdn.core.interview.application.port.in.ProcessLlmTokenUseCase;
import me.unbrdn.core.interview.application.port.out.CallLlmPort;
import me.unbrdn.core.interview.application.port.out.ManageSessionStatePort;
import me.unbrdn.core.interview.application.support.TurnStatePublisher;
import me.unbrdn.core.interview.domain.enums.InterviewStage;
import me.unbrdn.core.interview.domain.enums.PassFailStatus;
import me.unbrdn.core.interview.domain.model.InterviewSessionState;
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
    private final ManageSessionStatePort sessionStatePort;
    private final TurnStatePublisher turnStatePublisher;

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
        var builder =
                GenerateRequest.newBuilder()
                        .setInterviewId(command.getInterviewId())
                        .setUserId(command.getUserId())
                        .setUserText(command.getUserText())
                        .setStage(toProtoInterviewStage(command.getStage()))
                        .setScheduledDurationMinutes(command.getScheduledDurationMinutes())
                        .setRemainingTimeSeconds(command.getRemainingTimeSeconds())
                        .setCurrentDifficultyLevel(command.getCurrentDifficultyLevel())
                        .setLastInterviewerId(
                                command.getLastInterviewerId() == null
                                        ? (command.getParticipatingPersonas() != null
                                                        && !command.getParticipatingPersonas()
                                                                .isEmpty()
                                                ? command.getParticipatingPersonas().get(0)
                                                : "LEADER")
                                        : command.getLastInterviewerId())
                        .setInputRole(
                                command.getInputRole() == null ? "user" : command.getInputRole())
                        .setPersonaId(
                                command.getPersonaId() != null
                                        ? command.getPersonaId()
                                        : "DEFAULT");

        if (command.getResumeId() != null) {
            builder.setResumeId(command.getResumeId());
        }

        if (command.getCompanyName() != null) {
            builder.setCompanyName(command.getCompanyName());
        }
        if (command.getDomain() != null) {
            builder.setDomain(command.getDomain());
        }
        if (command.getParticipatingPersonas() != null) {
            builder.addAllParticipatingPersonas(command.getParticipatingPersonas());
        }

        if (command.getRound() != null) {
            builder.setRound(toProtoInterviewRound(command.getRound()));
        }

        if (command.getJobPostingUrl() != null) {
            builder.setJobPostingUrl(command.getJobPostingUrl());
        }
        if (command.getSelfIntroText() != null) {
            builder.setSelfIntroText(command.getSelfIntroText());
        }
        if (command.getForcedSpeakerId() != null) {
            builder.setForcedSpeakerId(command.getForcedSpeakerId());
        }

        return builder.build();
    }

    private me.unbrdn.core.grpc.common.v1.InterviewRoundProto toProtoInterviewRound(
            me.unbrdn.core.interview.domain.enums.InterviewRound round) {
        if (round == null)
            return me.unbrdn.core.grpc.common.v1.InterviewRoundProto.INTERVIEW_ROUND_UNSPECIFIED;
        return switch (round) {
            case TECHNICAL -> me.unbrdn.core.grpc.common.v1.InterviewRoundProto.TECHNICAL_ROUND;
            case CULTURE_FIT -> me.unbrdn.core.grpc.common.v1.InterviewRoundProto.CULTURE_ROUND;
            case EXECUTIVE -> me.unbrdn.core.grpc.common.v1.InterviewRoundProto.EXECUTIVE_ROUND;
        };
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

    @Override
    public GenerateReportResult generateReport(
            String interviewId, List<InterviewMessageJpaEntity> messages) {
        List<ReportMessage> protoMessages =
                messages.stream()
                        .map(
                                msg ->
                                        ReportMessage.newBuilder()
                                                .setRole(
                                                        msg.getRole() != null
                                                                ? msg.getRole().name()
                                                                : "")
                                                .setContent(
                                                        msg.getContent() != null
                                                                ? msg.getContent()
                                                                : "")
                                                .build())
                        .toList();

        GenerateReportRequest request =
                GenerateReportRequest.newBuilder()
                        .setInterviewId(interviewId)
                        .addAllMessages(protoMessages)
                        .build();

        GenerateReportResponse response = llmServiceBlockingStub.generateReport(request);

        PassFailStatus passFailStatus;
        try {
            passFailStatus = PassFailStatus.valueOf(response.getPassFailStatus());
        } catch (IllegalArgumentException e) {
            passFailStatus = PassFailStatus.HOLD;
        }

        return GenerateReportResult.builder()
                .totalScore(response.getTotalScore())
                .passFailStatus(passFailStatus)
                .summaryText(response.getSummaryText())
                .resumeFeedback(response.getResumeFeedback())
                .build();
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

    private void recoverSessionToListening(String interviewId) {
        try {
            sessionStatePort
                    .getState(interviewId)
                    .ifPresent(
                            state -> {
                                InterviewStage stage = state.getCurrentStage();
                                if (stage == InterviewStage.IN_PROGRESS
                                        || stage == InterviewStage.LAST_ANSWER) {
                                    state.setStatus(InterviewSessionState.Status.LISTENING);
                                    state.setCanCandidateSpeak(true);
                                    sessionStatePort.saveState(interviewId, state);
                                    turnStatePublisher.publish(interviewId, state);
                                    log.info(
                                            "Session recovered to LISTENING after LLM failure: interviewId={}",
                                            interviewId);
                                }
                            });
        } catch (Exception e) {
            log.error(
                    "Failed to recover session state after LLM failure: interviewId={}",
                    interviewId,
                    e);
        }
    }

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
                // LLM 완전 실패 시 세션 상태를 LISTENING으로 복구하여 사용자가 계속 답변할 수 있도록 함
                recoverSessionToListening(command.getInterviewId());
            }
        }

        @Override
        public void onCompleted() {
            log.info("LLM gRPC stream completed: interviewId={}", command.getInterviewId());
        }
    }
}
