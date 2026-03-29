package me.unbrdn.core.interview.adapter.in.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.dto.command.ProcessUserAnswerCommand;
import me.unbrdn.core.interview.application.port.in.ProcessUserAnswerUseCase;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.connection.stream.Consumer;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.connection.stream.ReadOffset;
import org.springframework.data.redis.connection.stream.StreamOffset;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.stream.StreamListener;
import org.springframework.data.redis.stream.StreamMessageListenerContainer;
import org.springframework.data.redis.stream.Subscription;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class SttTranscriptRedisStreamConsumer
        implements StreamListener<String, MapRecord<String, String, String>>, InitializingBean {

    private final StreamMessageListenerContainer<String, MapRecord<String, String, String>>
            listenerContainer;
    private final RedisTemplate<String, Object> redisTemplate;
    private final ProcessUserAnswerUseCase processUserAnswerUseCase;
    private final ObjectMapper objectMapper;

    @Value("${redis.stream.stt-transcript:interview:transcript:process}")
    private String streamKey;

    @Value("${redis.stream.stt-transcript-group:interview:transcript:cg:stt}")
    private String consumerGroup;

    @Value("${redis.stream.stt-transcript-consumer:core-consumer-1}")
    private String consumerName;

    private Subscription subscription;

    @Override
    public void afterPropertiesSet() {
        try {
            // Create Consumer Group if not exists
            try {
                redisTemplate
                        .opsForStream()
                        .createGroup(streamKey, ReadOffset.latest(), consumerGroup);
            } catch (Exception e) {
                // Group might already exist
                log.info("Redis Stream Consumer Group might already exist: {}", e.getMessage());
            }

            this.subscription =
                    listenerContainer.receive(
                            Consumer.from(consumerGroup, consumerName),
                            StreamOffset.create(streamKey, ReadOffset.lastConsumed()),
                            this);

            listenerContainer.start();
            log.info(
                    "STT Transcript Listener started. Key: {}, Group: {}",
                    streamKey,
                    consumerGroup);

        } catch (Exception e) {
            log.error("Failed to start STT Transcript Listener", e);
        }
    }

    @Override
    public void onMessage(MapRecord<String, String, String> message) {
        log.info("Received STT Transcript message: id={}", message.getId());

        try {
            Map<String, String> body = message.getValue();

            // STT payload 파싱: Python publisher가 {"payload": json_string} 형태로 publish
            String payloadJson = body.get("payload");
            if (payloadJson == null) {
                log.debug("Skipping message with no payload field");
                redisTemplate.opsForStream().acknowledge(streamKey, consumerGroup, message.getId());
                return;
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> payload = objectMapper.readValue(payloadJson, Map.class);
            String interviewId = (String) payload.get("interviewId");
            String text = (String) payload.get("text");
            String userId = (String) payload.get("userId");
            String traceId = (String) payload.get("traceId");
            Integer retryCount = (Integer) payload.getOrDefault("retryCount", 0);
            Boolean isFinal =
                    Boolean.parseBoolean(String.valueOf(payload.getOrDefault("isFinal", "false")));
            Boolean isEmpty =
                    Boolean.parseBoolean(String.valueOf(payload.getOrDefault("isEmpty", "false")));
            String stage = (String) payload.get("stage");

            // 빈 텍스트 또는 final이 아닌 경우 스킵
            if (isEmpty || !isFinal || text == null || text.trim().isEmpty()) {
                log.debug("Skipping non-final or empty STT message");
                redisTemplate.opsForStream().acknowledge(streamKey, consumerGroup, message.getId());
                return;
            }

            // ProcessUserAnswerCommand 생성
            ProcessUserAnswerCommand command =
                    ProcessUserAnswerCommand.builder()
                            .interviewId(interviewId)
                            .userId(userId)
                            .userText(text)
                            .persona("COMFORTABLE") // 기본값, 추후 payload에서 받을 수 있음
                            .traceId(traceId)
                            .retryCount(retryCount)
                            .stage(stage)
                            .build();

            // Use Case 호출
            processUserAnswerUseCase.execute(command);

            // ACK 처리
            redisTemplate.opsForStream().acknowledge(streamKey, consumerGroup, message.getId());

        } catch (Exception e) {
            log.error("Error processing STT Transcript message", e);
        }
    }
}
