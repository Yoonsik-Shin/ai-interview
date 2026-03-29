package me.unbrdn.core.config;

import java.time.Duration;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.RedisSentinelConfiguration;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.serializer.GenericJacksonJsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.springframework.data.redis.stream.StreamMessageListenerContainer;

@Configuration
public class InterviewRedisConfig {

    @Value("${spring.data.redis.host:localhost}")
    private String track1Host;

    @Value("${spring.data.redis.port:6379}")
    private int track1Port;

    @Value("${spring.data.redis.password:}")
    private String track1Password;

    @Value("${spring.data.redis.database:0}")
    private int track1Database;

    @Value("${spring.data.redis.sentinel.master:}")
    private String track1SentinelMaster;

    @Value("${spring.data.redis.sentinel.nodes:}")
    private String track1SentinelNodes;

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
                    @Qualifier("track1ConnectionFactory")
                            RedisConnectionFactory redisConnectionFactory,
                    @Qualifier("redisStreamTaskExecutor")
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

    @Bean(name = "track1ConnectionFactory")
    public RedisConnectionFactory track1ConnectionFactory() {
        if (track1SentinelMaster != null
                && !track1SentinelMaster.isEmpty()
                && track1SentinelNodes != null
                && !track1SentinelNodes.isEmpty()) {
            RedisSentinelConfiguration sentinelConfig = new RedisSentinelConfiguration();
            sentinelConfig.master(track1SentinelMaster);
            for (String node : track1SentinelNodes.split(",")) {
                String[] parts = node.trim().split(":");
                sentinelConfig.sentinel(parts[0], Integer.parseInt(parts[1]));
            }
            sentinelConfig.setDatabase(track1Database);
            if (!track1Password.isEmpty()) {
                sentinelConfig.setPassword(track1Password);
                sentinelConfig.setSentinelPassword(track1Password);
            }
            return new LettuceConnectionFactory(sentinelConfig);
        }

        RedisStandaloneConfiguration config =
                new RedisStandaloneConfiguration(track1Host, track1Port);
        config.setDatabase(track1Database);
        if (!track1Password.isEmpty()) {
            config.setPassword(track1Password);
        }
        return new LettuceConnectionFactory(config);
    }

    @Bean
    @Primary
    public RedisTemplate<String, Object> redisTemplate(
            @Qualifier("track1ConnectionFactory") RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(GenericJacksonJsonRedisSerializer.builder().build());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(GenericJacksonJsonRedisSerializer.builder().build());
        return template;
    }

    @Bean
    @Primary
    public StringRedisTemplate stringRedisTemplate(
            @Qualifier("track1ConnectionFactory") RedisConnectionFactory connectionFactory) {
        return new StringRedisTemplate(connectionFactory);
    }

    @Bean(name = "track3ConnectionFactory")
    public RedisConnectionFactory track3ConnectionFactory() {
        RedisStandaloneConfiguration config =
                new RedisStandaloneConfiguration(track3Host, track3Port);
        if (!track3Password.isEmpty()) {
            config.setPassword(track3Password);
        }

        LettuceClientConfiguration.LettuceClientConfigurationBuilder builder =
                LettuceClientConfiguration.builder();
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

    @Bean(name = "track3StringRedisTemplate")
    public StringRedisTemplate track3StringRedisTemplate(
            @Qualifier("track3ConnectionFactory") RedisConnectionFactory connectionFactory) {
        return new StringRedisTemplate(connectionFactory);
    }
}
