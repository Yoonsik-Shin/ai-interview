package me.unbrdn.core.common.infrastructure.persistence.converter;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.nio.ByteBuffer;
import java.util.UUID;

/**
 * UUID ↔ byte[] 변환기 (Oracle 호환용)
 *
 * <p>Oracle Database는 UUID 타입을 지원하지 않으므로, RAW(16)으로 저장합니다.
 *
 * <p>PostgreSQL에서는 네이티브 UUID 타입을 사용하고, Oracle에서는 명시적으로 이 Converter를 적용해야 합니다.
 *
 * <p>주의: {@code autoApply = true}를 제거하여 PostgreSQL에서는 네이티브 UUID를 사용하도록 했습니다. Oracle을 사용하는 경우, 필요한
 * 엔티티에 명시적으로 {@code @Convert(converter = UuidBinaryConverter.class)}를 적용해야 합니다.
 *
 * <h3>DB 설정:</h3>
 *
 * <ul>
 *   <li>PostgreSQL: {@code columnDefinition = "uuid"} (네이티브 UUID 타입 사용)
 *   <li>Oracle: {@code columnDefinition = "RAW(16)"} + {@code @Convert(converter =
 *       UuidBinaryConverter.class)}
 * </ul>
 *
 * <p>현재는 BaseEntity에서 {@code columnDefinition = "uuid"}로 설정되어 있으며, PostgreSQL에서는 네이티브 UUID를,
 * Oracle에서는 명시적 변환을 사용합니다.
 */
@Converter
public class UuidBinaryConverter implements AttributeConverter<UUID, byte[]> {

    /**
     * UUID → byte[] 변환 (DB 저장 시)
     *
     * @param uuid Java UUID 객체
     * @return 16바이트 배열
     */
    @Override
    public byte[] convertToDatabaseColumn(UUID uuid) {
        if (uuid == null) {
            return null;
        }

        ByteBuffer byteBuffer = ByteBuffer.wrap(new byte[16]);
        byteBuffer.putLong(uuid.getMostSignificantBits());
        byteBuffer.putLong(uuid.getLeastSignificantBits());
        return byteBuffer.array();
    }

    /**
     * byte[] → UUID 변환 (DB 조회 시)
     *
     * @param bytes 16바이트 배열
     * @return Java UUID 객체
     */
    @Override
    public UUID convertToEntityAttribute(byte[] bytes) {
        if (bytes == null || bytes.length != 16) {
            return null;
        }

        ByteBuffer byteBuffer = ByteBuffer.wrap(bytes);
        long mostSigBits = byteBuffer.getLong();
        long leastSigBits = byteBuffer.getLong();
        return new UUID(mostSigBits, leastSigBits);
    }
}
