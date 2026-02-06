package me.unbrdn.core.interview.adapter.out.redis;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.port.out.ManageConversationHistoryPort;
import me.unbrdn.core.interview.domain.model.ConversationHistory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class RedisConversationHistoryAdapter implements ManageConversationHistoryPort {

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private static final int MAX_HISTORY = 20;

    @Override
    public List<ConversationHistory> loadHistory(String interviewId) {
        String key = "interview:history:" + interviewId;
        String json = redisTemplate.opsForValue().get(key);
        if (json == null) {
            return new ArrayList<>();
        }

        try {
            return objectMapper.readValue(json, new TypeReference<List<ConversationHistory>>() {
            });
        } catch (Exception e) {
            log.error("Failed to parse conversation history", e);
            return new ArrayList<>();
        }
    }

    @Override
    public void appendExchange(String interviewId, String userText, String aiAnswer) {
        appendExchange(interviewId, "user", userText, aiAnswer);
    }

    @Override
    public void appendExchange(String interviewId, String role, String userText, String aiAnswer) {
        List<ConversationHistory> history = loadHistory(interviewId);
        history.add(new ConversationHistory(role, userText));
        history.add(new ConversationHistory("assistant", aiAnswer));

        // 최대 20개 유지
        if (history.size() > MAX_HISTORY) {
            history = history.subList(history.size() - MAX_HISTORY, history.size());
        }

        String key = "interview:history:" + interviewId;
        try {
            String json = objectMapper.writeValueAsString(history);
            redisTemplate.opsForValue().set(key, json, Duration.ofHours(1));
        } catch (Exception e) {
            log.error("Failed to save conversation history", e);
        }
    }
}
