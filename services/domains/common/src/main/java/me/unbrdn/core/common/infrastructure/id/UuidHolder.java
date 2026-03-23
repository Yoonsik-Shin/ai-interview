package me.unbrdn.core.common.infrastructure.id;

import java.util.UUID;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;
import org.springframework.stereotype.Component;

/**
 * UuidGenerator에 대한 정적 접근 헬퍼
 *
 * <p>Spring Bean을 정적 메서드에서 사용할 수 있도록 지원합니다.
 *
 * <p>사용 예시:
 *
 * <pre>{@code
 * @PrePersist
 * protected void generateId() {
 *     if (this.id == null) {
 *         this.id = UuidHolder.generate();
 *     }
 * }
 * }</pre>
 *
 * <p>주의: JPA 엔티티의 @PrePersist는 정적 컨텍스트가 아니지만, 테스트나 팩토리 메서드에서 유용합니다.
 */
@Component
public class UuidHolder implements ApplicationContextAware {

    private static ApplicationContext context;

    @Override
    public void setApplicationContext(ApplicationContext applicationContext) {
        context = applicationContext;
    }

    /**
     * UUIDv7 생성
     *
     * @return 시간순 정렬 가능한 UUID
     */
    public static UUID generate() {
        return context.getBean(UuidGenerator.class).generate();
    }
}
