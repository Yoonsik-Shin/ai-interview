package me.unbrdn.core.interview.adapter.out.redis;

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
        List<String> jsonList = redisTemplate.opsForList().range(key, 0, -1);
        if (jsonList == null || jsonList.isEmpty()) {
            return new ArrayList<>();
        }

        List<ConversationHistory> history = new ArrayList<>();
        for (String json : jsonList) {
            try {
                history.add(objectMapper.readValue(json, ConversationHistory.class));
            } catch (Exception e) {
                log.error("Failed to parse conversation history item", e);
            }
        }
        return history;
    }

    @Override
    public void appendExchange(String interviewId, String userText, String aiAnswer) {
        appendExchange(interviewId, "user", userText, aiAnswer);
    }

    @Override
    public void appendExchange(String interviewId, String role, String userText, String aiAnswer) {
        appendUserMessage(interviewId, role, userText);
        appendAiMessage(interviewId, aiAnswer);
    }

    @Override
    public void appendUserMessage(String interviewId, String role, String userText) {
        saveMessage(interviewId, new ConversationHistory(role, userText));
    }

    @Override
    public void appendAiMessage(String interviewId, String aiAnswer) {
        saveMessage(interviewId, new ConversationHistory("assistant", aiAnswer));
    }

    private void saveMessage(String interviewId, ConversationHistory historyItem) {
        String key = "interview:history:" + interviewId;
        try {
            String json = objectMapper.writeValueAsString(historyItem);
            redisTemplate.opsForList().rightPush(key, json);
            // 최대 20개 유지 (최신 20개)
            redisTemplate.opsForList().trim(key, -MAX_HISTORY, -1);
            redisTemplate.expire(key, Duration.ofHours(1));
        } catch (Exception e) {
            log.error("Failed to save conversation message", e);
        }
    }
}
