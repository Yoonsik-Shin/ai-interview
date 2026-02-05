package me.unbrdn.core.interview.adapter.out.redis;

import java.time.Duration;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.application.port.out.AppendRedisCachePort;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class RedisCacheAdapter implements AppendRedisCachePort {

    private final StringRedisTemplate redisTemplate;

    @Override
    public void appendToken(String interviewId, String token) {
        String key = "interview:response:" + interviewId;
        redisTemplate.opsForValue().append(key, token);
        redisTemplate.expire(key, Duration.ofHours(1));
    }
}
