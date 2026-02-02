package me.unbrdn.core.payment.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseTimeEntity;

/** 단품 패키지 상품 엔티티 */
@Entity
@Table(name = "package")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Package extends BaseTimeEntity {

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false)
    private Integer price;

    @Column(columnDefinition = "TEXT")
    private String description;

    private Package(String name, Integer price, String description) {
        this.name = name;
        this.price = price;
        this.description = description;
    }

    /** 새로운 패키지 생성 */
    public static Package create(String name, Integer price, String description) {
        return new Package(name, price, description);
    }

    /** 패키지 정보 업데이트 */
    public void update(String name, Integer price, String description) {
        this.name = name;
        this.price = price;
        this.description = description;
    }
}
