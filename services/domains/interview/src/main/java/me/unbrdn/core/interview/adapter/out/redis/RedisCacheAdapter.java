package me.unbrdn.core.interview.adapter.out.redis;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.port.out.AppendRedisCachePort;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class RedisCacheAdapter implements AppendRedisCachePort {

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public void appendToken(String interviewId, String token, String persona) {
        String key = "interview:response:" + interviewId;

        try {
            TokenResponse response = new TokenResponse(persona, token);
            String jsonValue = objectMapper.writeValueAsString(response);

            redisTemplate.opsForList().rightPush(key, jsonValue);
            redisTemplate.expire(key, Duration.ofHours(1));
        } catch (Exception e) {
            log.error("Failed to append token to Redis cache", e);
        }
    }

    @Override
    public void appendSentenceBuffer(String interviewId, String token) {
        String key = "interview:llm:sentence:" + interviewId;
        redisTemplate.opsForValue().append(key, token);
        redisTemplate.expire(key, Duration.ofMinutes(10));
    }

    @Override
    public String getAndClearSentenceBuffer(String interviewId) {
        String key = "interview:llm:sentence:" + interviewId;
        String sentence = redisTemplate.opsForValue().get(key);
        redisTemplate.delete(key);
        return sentence == null ? "" : sentence;
    }

    @Override
    public void appendFullResponseBuffer(String interviewId, String token) {
        String key = "interview:llm:buffer:" + interviewId;
        redisTemplate.opsForValue().append(key, token);
        redisTemplate.expire(key, Duration.ofMinutes(30));
    }

    @Override
    public String getAndClearFullResponseBuffer(String interviewId) {
        String key = "interview:llm:buffer:" + interviewId;
        String fullResponse = redisTemplate.opsForValue().get(key);
        redisTemplate.delete(key);
        return fullResponse == null ? "" : fullResponse;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TokenResponse {
        private String persona;
        private String token;
    }
}
