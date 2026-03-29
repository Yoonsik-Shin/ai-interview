package me.unbrdn.core.interview.adapter.out.redis;

import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.port.out.SaveSentenceStreamPort;
import me.unbrdn.core.interview.domain.enums.MessageRole;
import me.unbrdn.core.interview.domain.enums.MessageSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.connection.stream.StreamRecords;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class RedisStreamsSentenceAdapter implements SaveSentenceStreamPort {
    private final StringRedisTemplate redisTemplate;
    
    @Value("${redis.stream.sentence-stream:interview:sentence:stream}")
    private String streamKey;

    public RedisStreamsSentenceAdapter(
            @Qualifier("track3StringRedisTemplate") StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public void publishSentence(
            String interviewId,
            String personaId,
            int sentenceIndex,
            String sentence,
            boolean isFinal,
            String mode,
            Integer difficultyLevel,
            Integer turnCount,
            String stage,
            MessageRole role,
            MessageSource source) {

        Map<String, String> message = new HashMap<>();
        message.put("interviewId", interviewId);
        message.put("personaId", personaId != null ? personaId : "DEFAULT");
        message.put("sentenceIndex", String.valueOf(sentenceIndex));
        message.put("sentence", sentence);
        message.put("isFinal", String.valueOf(isFinal));
        if (mode != null) {
            message.put("mode", mode);
        }
        if (difficultyLevel != null) {
            message.put("difficultyLevel", String.valueOf(difficultyLevel));
        }
        if (turnCount != null) {
            message.put("turnCount", String.valueOf(turnCount));
        }
        if (stage != null) {
            message.put("stage", stage);
        }
        if (role != null) {
            message.put("role", role.name());
        }
        if (source != null) {
            message.put("source", source.name());
        }

        MapRecord<String, String, String> record =
                StreamRecords.newRecord().in(streamKey).ofMap(message);

        redisTemplate.opsForStream().add(record);
        log.debug(
                "Published sentence to stream {}: interviewId={}, sentenceIndex={}, isFinal={}",
                streamKey,
                interviewId,
                sentenceIndex,
                isFinal);
    }
}
