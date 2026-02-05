package me.unbrdn.core.interview.adapter.out.cache;

import java.util.Optional;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.port.out.ManageSessionStatePort;
import me.unbrdn.core.interview.domain.model.InterviewSessionState;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class InterviewSessionCacheAdapter implements ManageSessionStatePort {

    private final RedisTemplate<String, Object> redisTemplate;
    private static final String KEY_PREFIX = "interview:session:";
    private static final String KEY_SUFFIX = ":state";
    private static final long TTL_HOURS = 2;

    @Override
    public void saveState(String sessionId, InterviewSessionState state) {
        String key = buildKey(sessionId);
        try {
            redisTemplate.opsForValue().set(key, state, TTL_HOURS, TimeUnit.HOURS);
            log.debug("Saved interview session state to Redis: {}", sessionId);
        } catch (Exception e) {
            log.error("Failed to save interview session state to Redis", e);
        }
    }

    @Override
    public Optional<InterviewSessionState> getState(String sessionId) {
        String key = buildKey(sessionId);
        try {
            Object state = redisTemplate.opsForValue().get(key);
            if (state instanceof InterviewSessionState) {
                return Optional.of((InterviewSessionState) state);
            }
        } catch (Exception e) {
            log.error("Failed to get interview session state from Redis", e);
        }
        return Optional.empty();
    }

    @Override
    public void deleteState(String sessionId) {
        String key = buildKey(sessionId);
        try {
            redisTemplate.delete(key);
            log.debug("Deleted interview session state from Redis: {}", sessionId);
        } catch (Exception e) {
            log.error("Failed to delete interview session state from Redis", e);
        }
    }

    private String buildKey(String sessionId) {
        return KEY_PREFIX + sessionId + KEY_SUFFIX;
    }
}
