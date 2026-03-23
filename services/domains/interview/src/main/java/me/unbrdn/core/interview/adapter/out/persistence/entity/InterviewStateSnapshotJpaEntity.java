package me.unbrdn.core.interview.adapter.out.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "interview_state_snapshot")
@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InterviewStateSnapshotJpaEntity {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "interview_session_id", nullable = false)
    private UUID interviewSessionId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "state_json", nullable = false, columnDefinition = "jsonb")
    private Object stateJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
