package me.unbrdn.core.interview.adapter.out.cache;

import java.util.Optional;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.event.SessionStateUpdatedEvent;
import me.unbrdn.core.interview.application.port.out.ManageSessionStatePort;
import me.unbrdn.core.interview.domain.model.InterviewSessionState;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class InterviewSessionCacheAdapter implements ManageSessionStatePort {
    private final RedisTemplate<String, Object> redisTemplate;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    private final ApplicationEventPublisher eventPublisher;

    public InterviewSessionCacheAdapter(
            @Qualifier("track3RedisTemplate") RedisTemplate<String, Object> redisTemplate,
            com.fasterxml.jackson.databind.ObjectMapper objectMapper,
            ApplicationEventPublisher eventPublisher) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.eventPublisher = eventPublisher;
    }

    private static final String KEY_PREFIX = "interview:session:hash:";
    private static final String KEY_SUFFIX = "";
    private static final long TTL_HOURS = 2;

    @Override
    public void saveState(String interviewId, InterviewSessionState state) {
        String key = buildKey(interviewId);
        try {
            // ObjectMapper를 사용하여 객체를 Map으로 동적 변환 (하드코딩 제거)
            java.util.Map<String, Object> map =
                    objectMapper.convertValue(
                            state,
                            new com.fasterxml.jackson.core.type.TypeReference<
                                    java.util.Map<String, Object>>() {});

            if (map != null && !map.isEmpty()) {
                // null 값 제거 (Redis Hash에 null을 넣지 않기 위함)
                map.values().removeIf(java.util.Objects::isNull);

                redisTemplate.opsForHash().putAll(key, map);
                redisTemplate.expire(key, TTL_HOURS, TimeUnit.HOURS);
                log.debug("Saved interview session state to Redis HASH: {}", interviewId);

                // Publish Application Event for Async DB Snapshot
                eventPublisher.publishEvent(new SessionStateUpdatedEvent(this, interviewId, state));
            }
        } catch (Exception e) {
            log.error("Failed to save interview session state to Redis", e);
        }
    }

    @Override
    public Optional<InterviewSessionState> getState(String interviewId) {
        String key = buildKey(interviewId);
        try {
            java.util.Map<Object, Object> entries = redisTemplate.opsForHash().entries(key);
            if (entries.isEmpty()) {
                return Optional.empty();
            }

            // Map을 다시 POJO로 동적 변환
            InterviewSessionState state =
                    objectMapper.convertValue(entries, InterviewSessionState.class);
            return Optional.ofNullable(state);
        } catch (Exception e) {
            log.error("Failed to get interview session state from Redis", e);
        }
        return Optional.empty();
    }

    @Override
    public void deleteState(String interviewId) {
        String key = buildKey(interviewId);
        try {
            redisTemplate.delete(key);
            log.debug("Deleted interview session state from Redis: {}", interviewId);
        } catch (Exception e) {
            log.error("Failed to delete interview session state from Redis", e);
        }
    }

    @Override
    public int incrementTurnCount(String interviewId) {
        String key = buildKey(interviewId);
        try {
            Long turnCount = redisTemplate.opsForHash().increment(key, "turnCount", 1L);
            redisTemplate.expire(key, TTL_HOURS, TimeUnit.HOURS);

            // Publish Event by fetching updated state
            getState(interviewId)
                    .ifPresent(
                            state ->
                                    eventPublisher.publishEvent(
                                            new SessionStateUpdatedEvent(
                                                    this, interviewId, state)));

            return turnCount != null ? turnCount.intValue() : 0;
        } catch (Exception e) {
            log.error("Failed to increment turn count in Redis", e);
            return 0;
        }
    }

    @Override
    public int incrementSelfIntroRetryCount(String interviewId) {
        String key = buildKey(interviewId);
        try {
            Long count = redisTemplate.opsForHash().increment(key, "selfIntroRetryCount", 1L);
            redisTemplate.expire(key, TTL_HOURS, TimeUnit.HOURS);

            // [NEW] 세션 상태 업데이트 이벤트 전파 (비동기 DB 스냅샷용)
            getState(interviewId)
                    .ifPresent(
                            state ->
                                    eventPublisher.publishEvent(
                                            new SessionStateUpdatedEvent(this, interviewId, state)));

            return count != null ? count.intValue() : 0;
        } catch (Exception e) {
            log.error("Failed to increment self-intro retry count in Redis", e);
            return 0;
        }
    }

    @Override
    public void updateStatus(
            String interviewId, InterviewSessionState.Status status, boolean canCandidateSpeak) {
        String key = buildKey(interviewId);
        try {
            java.util.Map<String, String> updates = new java.util.HashMap<>();
            updates.put("status", status.name());
            updates.put("canCandidateSpeak", String.valueOf(canCandidateSpeak));

            redisTemplate.opsForHash().putAll(key, updates);
            redisTemplate.expire(key, TTL_HOURS, TimeUnit.HOURS);
            log.debug("Updated status fields in Redis HASH for interview: {}", interviewId);
        } catch (Exception e) {
            log.error("Failed to update status fields in Redis", e);
        }
    }

    private String buildKey(String interviewId) {
        return KEY_PREFIX + interviewId + KEY_SUFFIX;
    }
}
