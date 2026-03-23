package me.unbrdn.core.payment.domain.entity;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseEntity;

/** 단품 패키지 상품 엔티티 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Package extends BaseEntity {

    private String name;

    private Integer price;

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
