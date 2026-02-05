package me.unbrdn.core.common.config;

import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJacksonJsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.springframework.data.redis.stream.StreamMessageListenerContainer;

@Configuration
public class RedisConfig {

    @Value("${redis.stream.interview-result:stt:transcript:stream}")
    private String interviewResultStreamKey;

    @Value("${redis.stream.interview-result-group:core-interview-result-group}")
    private String interviewResultGroup;

    @Bean
    public RedisTemplate<String, Object> redisTemplate(
            RedisConnectionFactory redisConnectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(redisConnectionFactory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(GenericJacksonJsonRedisSerializer.builder().build());
        return template;
    }

    @Bean
    public StreamMessageListenerContainer<String, MapRecord<String, String, String>>
            streamMessageListenerContainer(RedisConnectionFactory redisConnectionFactory) {
        StreamMessageListenerContainer.StreamMessageListenerContainerOptions<
                        String, MapRecord<String, String, String>>
                options =
                        StreamMessageListenerContainer.StreamMessageListenerContainerOptions
                                .builder()
                                .pollTimeout(Duration.ofMillis(100))
                                .build();
        return StreamMessageListenerContainer.create(redisConnectionFactory, options);
    }
}
