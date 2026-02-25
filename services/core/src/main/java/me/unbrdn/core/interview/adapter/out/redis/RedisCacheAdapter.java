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

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TokenResponse {
        private String persona;
        private String token;
    }
}
