package me.unbrdn.core.reference.domain;

import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.user.domain.entity.User;

/** 커리어 엔티티 사용자의 경력 정보 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Career extends BaseTimeEntity {

    private User user;

    private JobField jobField;

    private String companyName;

    private String department;

    private LocalDate startedAt;

    private LocalDate endedAt;

    private String description;

    private Career(
            User user,
            JobField jobField,
            String companyName,
            String department,
            LocalDate startedAt,
            LocalDate endedAt,
            String description) {
        this.user = user;
        this.jobField = jobField;
        this.companyName = companyName;
        this.department = department;
        this.startedAt = startedAt;
        this.endedAt = endedAt;
        this.description = description;
    }

    /** 새로운 경력 생성 */
    public static Career create(
            User user,
            JobField jobField,
            String companyName,
            String department,
            LocalDate startedAt,
            LocalDate endedAt,
            String description) {
        return new Career(user, jobField, companyName, department, startedAt, endedAt, description);
    }

    /** 경력 정보 업데이트 */
    public void update(
            String companyName,
            String department,
            LocalDate startedAt,
            LocalDate endedAt,
            String description,
            JobField jobField) {
        this.companyName = companyName;
        this.department = department;
        this.startedAt = startedAt;
        this.endedAt = endedAt;
        this.description = description;
        this.jobField = jobField;
    }

    /** 재직 중 여부 확인 */
    public boolean isCurrentlyWorking() {
        return this.endedAt == null;
    }
}
