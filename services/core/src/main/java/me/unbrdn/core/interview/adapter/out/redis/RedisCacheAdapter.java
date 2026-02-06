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
    public void appendToken(String interviewId, String token, String persona) {
        String key = "interview:response:" + interviewId;
        // 단순 텍스트 누적 대신 JSON 형식으로 리스트에 저장 (또는 텍스트에 마킹)
        // 여기서는 기존 텍스트 누적 방식을 유지하되, 발화자 식별을 위해 특수 마커를 추가하거나
        // 혹은 아예 리스트 구조로 변경하는 것이 좋음.
        // 현재 프론트엔드 호환성을 고려하여, 텍스트에 "PERSONA: [persona]\nTOKEN: [token]" 형식을 쓰거나
        // 아니면 리스트(RPUSH)로 저장하고 TTL 설정.

        // 사용자의 요청대로 "누가 한말인지 제대로 처리"하기 위해 JSON 객체로 저장
        String jsonValue = String.format("{\"persona\":\"%s\",\"token\":\"%s\"}", persona, token.replace("\"", "\\\""));
        redisTemplate.opsForList().rightPush(key, jsonValue);
        redisTemplate.expire(key, Duration.ofHours(1));
    }
}
