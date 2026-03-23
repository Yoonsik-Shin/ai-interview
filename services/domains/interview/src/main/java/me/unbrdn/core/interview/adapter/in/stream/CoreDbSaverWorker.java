package me.unbrdn.core.interview.adapter.in.stream;

import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.dto.command.SaveInterviewMessageCommand;
import me.unbrdn.core.interview.application.port.in.SaveInterviewMessageUseCase;
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

    private final StringRedisTemplate redisTemplate;
    private final SaveInterviewMessageUseCase saveInterviewMessageUseCase;

    private static final String STREAM_KEY = "interview:sentence:stream";
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
                                    StreamOffset.create(STREAM_KEY, ReadOffset.lastConsumed()));

            if (messages == null || messages.isEmpty()) {
                return;
            }

            for (MapRecord<String, Object, Object> record : messages) {
                Map<Object, Object> value = record.getValue();
                String interviewId = (String) value.get("interviewId");
                String personaId = (String) value.get("personaId");
                int sentenceIndex = Integer.parseInt((String) value.get("sentenceIndex"));
                String sentence = (String) value.get("sentence");
                boolean isFinal = Boolean.parseBoolean((String) value.get("isFinal"));

                SaveInterviewMessageCommand command =
                        SaveInterviewMessageCommand.builder()
                                .interviewId(interviewId)
                                .personaId(personaId)
                                .sentenceIndex(sentenceIndex)
                                .sentence(sentence)
                                .isFinal(isFinal)
                                .build();

                saveInterviewMessageUseCase.execute(command);
                redisTemplate
                        .opsForStream()
                        .acknowledge(STREAM_KEY, CONSUMER_GROUP, record.getId());
                log.debug("Acknowledged stream message: {}", record.getId());
            }
        } catch (Exception e) {
            log.error("Error processing stream messages in CoreDbSaverWorker", e);
        }
    }

    private void createConsumerGroupIfNotExists() {
        try {
            redisTemplate
                    .opsForStream()
                    .createGroup(STREAM_KEY, ReadOffset.from("0"), CONSUMER_GROUP);
        } catch (Exception e) {
            // Group typically already exists
        }
    }
}
