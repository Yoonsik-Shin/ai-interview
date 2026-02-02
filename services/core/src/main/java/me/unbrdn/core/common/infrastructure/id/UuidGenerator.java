package me.unbrdn.core.common.infrastructure.id;

import com.github.f4b6a3.uuid.UuidCreator;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * UUIDv7 생성기
 *
 * <p>UUIDv7은 RFC 9562 표준으로, 시간순 정렬이 가능한 UUID입니다.
 *
 * <p>특징:
 *
 * <ul>
 *   <li>시간순 정렬: 생성 시간순으로 정렬 가능 (B-tree 인덱스 성능 우수)
 *   <li>분산 환경: 서비스 간 ID 충돌 없음
 *   <li>표준 준수: RFC 9562 (2024년 표준화)
 *   <li>DB 호환성: PostgreSQL UUID, Oracle RAW(16) 모두 지원
 * </ul>
 *
 * <p>생성 예시: {@code 018d3f4e-7890-7abc-def0-1234567890ab}
 *
 * <p>구조:
 *
 * <ul>
 *   <li>앞 48bit: Unix timestamp (밀리초)
 *   <li>버전 필드: 0x7 (UUIDv7 식별)
 *   <li>뒷 62bit: 랜덤 (충돌 방지)
 * </ul>
 */
@Component
public class UuidGenerator {

    /**
     * UUIDv7 생성
     *
     * @return 시간순 정렬 가능한 UUID
     */
    public UUID generate() {
        return UuidCreator.getTimeOrderedEpoch();
    }
}
