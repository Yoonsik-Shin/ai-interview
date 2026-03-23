package me.unbrdn.core.config;

import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJacksonJsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.springframework.data.redis.stream.StreamMessageListenerContainer;

@Configuration
public class InterviewRedisConfig {

    @Value("${redis.stream.interview-result:stt:transcript:stream}")
    private String interviewResultStreamKey;

    @Value("${redis.stream.interview-result-group:core-interview-result-group}")
    private String interviewResultGroup;

    // ===============================
    // Track 3 Redis (Azure) Properties
    // ===============================
    @Value("${redis.track3.host:localhost}")
    private String track3Host;

    @Value("${redis.track3.port:6379}")
    private int track3Port;

    @Value("${redis.track3.password:}")
    private String track3Password;

    @Value("${redis.track3.ssl:false}")
    private boolean track3Ssl;

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
                    RedisConnectionFactory redisConnectionFactory, // Auto-configured (Track 1)
                    @Qualifier("redisStreamTaskExecutor")
                            org.springframework.core.task.TaskExecutor taskExecutor) {
        StreamMessageListenerContainer.StreamMessageListenerContainerOptions<
                        String, MapRecord<String, String, String>>
                options = StreamMessageListenerContainer.StreamMessageListenerContainerOptions
                                .builder()
                                .pollTimeout(Duration.ofMillis(100))
                                .executor(taskExecutor)
                                .build();
        return StreamMessageListenerContainer.create(redisConnectionFactory, options);
    }

    // ===============================
    // Track 1 RedisTemplate (Default)
    // ===============================
    @Bean
    @Primary
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(GenericJacksonJsonRedisSerializer.builder().build());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(GenericJacksonJsonRedisSerializer.builder().build());
        return template;
    }

    // ===============================
    // Track 3 Connection Factory & Template
    // ===============================
    @Bean(name = "track3ConnectionFactory")
    public RedisConnectionFactory track3ConnectionFactory() {
        RedisStandaloneConfiguration config = new RedisStandaloneConfiguration(track3Host, track3Port);
        if (!track3Password.isEmpty()) {
            config.setPassword(track3Password);
        }

        LettuceClientConfiguration.LettuceClientConfigurationBuilder builder = LettuceClientConfiguration.builder();
        if (track3Ssl) {
            builder.useSsl();
        }
        
        return new LettuceConnectionFactory(config, builder.build());
    }

    @Bean(name = "track3RedisTemplate")
    public RedisTemplate<String, Object> track3RedisTemplate(
            @Qualifier("track3ConnectionFactory") RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(GenericJacksonJsonRedisSerializer.builder().build());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(GenericJacksonJsonRedisSerializer.builder().build());
        return template;
    }
}
