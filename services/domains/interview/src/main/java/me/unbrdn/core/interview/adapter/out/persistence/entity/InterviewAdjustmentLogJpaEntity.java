package me.unbrdn.core.interview.adapter.out.persistence.entity;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.adapter.out.persistence.entity.BaseTimeJpaEntity;

@Entity
@Table(name = "interview_adjustment_log")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InterviewAdjustmentLogJpaEntity extends BaseTimeJpaEntity {

    @Column(name = "interview_id", nullable = false)
    private UUID interviewId;

    @Column(name = "adjustment_type", nullable = false, length = 50)
    private String adjustmentType;

    @Column(name = "old_value", columnDefinition = "TEXT")
    private String oldValue;

    @Column(name = "new_value", columnDefinition = "TEXT")
    private String newValue;

    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason;
}
