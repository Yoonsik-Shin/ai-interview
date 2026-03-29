package me.unbrdn.core.config;

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

    @Value("${redis.stream.interview-result:interview:transcript:process}")
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
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(GenericJacksonJsonRedisSerializer.builder().build());
        return template;
    }

    @Bean(name = "redisStreamTaskExecutor")
    public org.springframework.core.task.TaskExecutor redisStreamTaskExecutor() {
        org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor executor =
                new org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("redis-stream-");
        executor.initialize();
        return executor;
    }

    @Bean
    public StreamMessageListenerContainer<String, MapRecord<String, String, String>>
            streamMessageListenerContainer(
                    RedisConnectionFactory redisConnectionFactory,
                    @org.springframework.beans.factory.annotation.Qualifier(
                                    "redisStreamTaskExecutor")
                            org.springframework.core.task.TaskExecutor taskExecutor) {
        StreamMessageListenerContainer.StreamMessageListenerContainerOptions<
                        String, MapRecord<String, String, String>>
                options =
                        StreamMessageListenerContainer.StreamMessageListenerContainerOptions
                                .builder()
                                .pollTimeout(Duration.ofMillis(100))
                                .executor(taskExecutor)
                                .build();
        return StreamMessageListenerContainer.create(redisConnectionFactory, options);
    }
}
