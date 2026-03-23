package me.unbrdn.core.config;

import org.springframework.util.backoff.BackOff;
import org.springframework.util.backoff.BackOffExecution;

/**
 * Exponential backoff with jitter.
 * Retry 간격: initialInterval * multiplier^n * (1 ± jitterFactor)
 * 예: 5회, 초기 1s, 2x 배율, ±30% jitter → 1s, 2s, 4s, 8s, 16s 전후
 */
public class JitterExponentialBackOff implements BackOff {

    private final int maxRetries;
    private final long initialIntervalMs;
    private final double multiplier;
    private final long maxIntervalMs;
    private final double jitterFactor;

    public JitterExponentialBackOff(int maxRetries, long initialIntervalMs,
                                    double multiplier, long maxIntervalMs, double jitterFactor) {
        this.maxRetries = maxRetries;
        this.initialIntervalMs = initialIntervalMs;
        this.multiplier = multiplier;
        this.maxIntervalMs = maxIntervalMs;
        this.jitterFactor = jitterFactor;
    }

    @Override
    public BackOffExecution start() {
        return new JitterBackOffExecution();
    }

    private class JitterBackOffExecution implements BackOffExecution {
        private int attempt = 0;

        @Override
        public long nextBackOff() {
            if (attempt >= maxRetries) {
                return STOP;
            }
            long base = (long) (initialIntervalMs * Math.pow(multiplier, attempt));
            base = Math.min(base, maxIntervalMs);
            // ±jitterFactor 범위 내 랜덤 적용 (예: 0.3 → 70%~130%)
            double jitter = 1.0 - jitterFactor + (Math.random() * jitterFactor * 2);
            attempt++;
            return (long) (base * jitter);
        }
    }
}
