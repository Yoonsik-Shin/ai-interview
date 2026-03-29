package me.unbrdn.core.interview.adapter.in.stream;

import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.dto.command.SaveInterviewMessageCommand;
import me.unbrdn.core.interview.application.port.in.SaveInterviewMessageUseCase;
import me.unbrdn.core.interview.domain.enums.MessageRole;
import me.unbrdn.core.interview.domain.enums.MessageSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.connection.stream.Consumer;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.connection.stream.ReadOffset;
import org.springframework.data.redis.connection.stream.StreamOffset;
import org.springframework.data.redis.connection.stream.StreamReadOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class CoreDbSaverWorker {

    @Qualifier("track3StringRedisTemplate")
    private final StringRedisTemplate redisTemplate;

    private final SaveInterviewMessageUseCase saveInterviewMessageUseCase;
    private final me.unbrdn.core.interview.application.support.InterviewMessagePersistencePolicy persistencePolicy;
    
    @Value("${redis.stream.sentence-stream:interview:sentence:stream}")
    private String streamKey;
    
    private static final String CONSUMER_GROUP = "CG_DB_SAVER";
    private static final String CONSUMER_NAME = "worker-1";

    @SuppressWarnings("unchecked")
    @Scheduled(fixedDelay = 1000)
    public void processStreamMessages() {
        createConsumerGroupIfNotExists();

        try {
            List<MapRecord<String, Object, Object>> messages =
                    redisTemplate
                            .opsForStream()
                            .read(
                                    Consumer.from(CONSUMER_GROUP, CONSUMER_NAME),
                                    StreamReadOptions.empty().count(10),
                                    StreamOffset.create(streamKey, ReadOffset.lastConsumed()));

            if (messages == null || messages.isEmpty()) {
                return;
            }

            log.info("Processing {} messages from stream {}", messages.size(), streamKey);

            for (MapRecord<String, Object, Object> record : messages) {
                try {
                    Map<Object, Object> value = record.getValue();
                    String interviewId = (String) value.get("interviewId");
                    String personaId = (String) value.get("personaId");
                    String sentenceIndexStr = (String) value.get("sentenceIndex");
                    int sentenceIndex =
                            (sentenceIndexStr != null) ? Integer.parseInt(sentenceIndexStr) : 0;
                    String sentence = (String) value.get("sentence");
                    boolean isFinal = Boolean.parseBoolean((String) value.get("isFinal"));

                    if (interviewId == null || sentence == null) {
                        log.warn(
                                "Skipping invalid stream message: id={}, recordId={}",
                                interviewId,
                                record.getId());
                        redisTemplate
                                .opsForStream()
                                .acknowledge(streamKey, CONSUMER_GROUP, record.getId());
                        continue;
                    }

                    log.debug(
                            "Found message: interviewId={}, personaId={}, seq={}, final={}, text={}",
                            interviewId,
                            personaId,
                            sentenceIndex,
                            isFinal,
                            sentence.length() > 20 ? sentence.substring(0, 20) + "..." : sentence);

                    // [FIX] difficultyLevel 및 turnCount 파싱 안전성 확보
                    String difficultyStr = (String) value.get("difficultyLevel");
                    Integer difficultyLevel =
                            (difficultyStr != null) ? Integer.parseInt(difficultyStr) : null;
                    String turnCountStr = (String) value.get("turnCount");
                    Integer turnCount =
                            (turnCountStr != null) ? Integer.parseInt(turnCountStr) : null;
                    String stage = (String) value.get("stage");
                    String roleStr = (String) value.get("role");
                    MessageRole role =
                            (roleStr != null && !roleStr.isBlank())
                                    ? MessageRole.valueOf(roleStr)
                                    : MessageRole.AI;
                    String sourceStr = (String) value.get("source");
                    MessageSource source =
                            (sourceStr != null && !sourceStr.isBlank())
                                    ? MessageSource.valueOf(sourceStr)
                                    : MessageSource.LLM;

                    SaveInterviewMessageCommand command =
                            SaveInterviewMessageCommand.builder()
                                    .interviewId(interviewId)
                                    .personaId(personaId)
                                    .role(role)
                                    .source(source)
                                    .turnCount(turnCount)
                                    .sentenceIndex(sentenceIndex)
                                    .sentence(sentence)
                                    .isFinal(isFinal)
                                    .difficultyLevel(difficultyLevel)
                                    .stage(stage)
                                    .build();

                    // [FIX] InterviewMessagePersistencePolicy를 사용하여 저장 여부 결정
                    me.unbrdn.core.interview.domain.enums.InterviewStage stageEnum = 
                            (stage != null) ? me.unbrdn.core.interview.domain.enums.InterviewStage.valueOf(stage) : null;
                    
                    if (persistencePolicy.shouldPersist(stageEnum, role)) {
                        saveInterviewMessageUseCase.execute(command);
                        log.info(
                                "Successfully saved message: interviewId={}, turn={}, seq={}, role={}, source={}, stage={}",
                                interviewId,
                                turnCount,
                                sentenceIndex,
                                role,
                                source,
                                stage);
                    } else {
                        log.info("Skipping message persistence per policy: interviewId={}, stage={}, role={}", 
                                interviewId, stage, role);
                    }

                    redisTemplate
                            .opsForStream()
                            .acknowledge(streamKey, CONSUMER_GROUP, record.getId());
                } catch (Exception e) {
                    log.error(
                            "Failed to process individual stream message: recordId={}",
                            record.getId(),
                            e);
                    // 에러 발생 시에도 acknowledge를 할지 고민되나, 현재는 무한 루프 방지를 위해 skip 시 acknowledge 처리 권고
                }
            }
        } catch (Exception e) {
            log.error("Error processing stream messages in CoreDbSaverWorker", e);
        }
    }

    private void createConsumerGroupIfNotExists() {
        try {
            redisTemplate
                    .opsForStream()
                    .createGroup(streamKey, ReadOffset.from("0"), CONSUMER_GROUP);
        } catch (Exception e) {
            // Group typically already exists
        }
    }
}
