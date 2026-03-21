package me.unbrdn.core.interview.adapter.out.redis;

import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.port.out.SaveSentenceStreamPort;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.connection.stream.StreamRecords;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class RedisStreamsSentenceAdapter implements SaveSentenceStreamPort {

    private final StringRedisTemplate redisTemplate;
    private static final String STREAM_KEY = "interview:sentence:stream";

    @Override
    public void publishSentence(
            String interviewId,
            String personaId,
            int sentenceIndex,
            String sentence,
            boolean isFinal,
            String mode) {

        Map<String, String> message = new HashMap<>();
        message.put("interviewId", interviewId);
        message.put("personaId", personaId != null ? personaId : "DEFAULT");
        message.put("sentenceIndex", String.valueOf(sentenceIndex));
        message.put("sentence", sentence);
        message.put("isFinal", String.valueOf(isFinal));
        if (mode != null) {
            message.put("mode", mode);
        }

        MapRecord<String, String, String> record =
                StreamRecords.newRecord().in(STREAM_KEY).ofMap(message);

        redisTemplate.opsForStream().add(record);
        log.info(
                "Published sentence to stream {}: interviewId={}, sentenceIndex={}, isFinal={}",
                STREAM_KEY,
                interviewId,
                sentenceIndex,
                isFinal);
    }
}
