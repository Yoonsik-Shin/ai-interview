package me.unbrdn.core.interview.adapter.out.persistence.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.adapter.out.persistence.entity.BaseTimeJpaEntity;
import me.unbrdn.core.interview.domain.entity.InterviewMessage;
import me.unbrdn.core.interview.domain.enums.InterviewStage;
import me.unbrdn.core.interview.domain.enums.MessageRole;
import me.unbrdn.core.interview.domain.enums.MessageSource;

@Entity
@Table(name = "interview_messages")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InterviewMessageJpaEntity extends BaseTimeJpaEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "interview_session_id", nullable = false)
    private InterviewSessionJpaEntity interview;

    @Column(name = "turn_count", nullable = false)
    private Integer turnCount;

    @Column(name = "sequence_number", nullable = false)
    private Integer sequenceNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private InterviewStage stage;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MessageRole role;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private MessageSource source;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "media_url", length = 2048)
    private String mediaUrl;

    @Column(name = "persona_id", length = 50)
    private String personaId;

    @Column(name = "difficulty_level")
    private Integer difficultyLevel;

    /** 도메인 Entity -> JpaEntity 변환 */
    public static InterviewMessageJpaEntity fromDomain(
            InterviewMessage message, InterviewSessionJpaEntity session) {
        return InterviewMessageJpaEntity.builder()
                .id(message.getId())
                .interview(session)
                .turnCount(message.getTurnCount())
                .sequenceNumber(message.getSequenceNumber())
                .stage(message.getStage())
                .role(message.getRole())
                .source(message.getSource())
                .content(message.getContent())
                .mediaUrl(message.getMediaUrl())
                .personaId(message.getPersonaId())
                .difficultyLevel(message.getDifficultyLevel())
                .createdAt(message.getCreatedAt())
                .updatedAt(message.getUpdatedAt())
                .build();
    }

    /** JpaEntity -> 도메인 Entity 변환 */
    public InterviewMessage toDomain() {
        return InterviewMessage.create(
                null, // 세션은 필요하면 로지칼하게 바인딩
                this.turnCount,
                this.sequenceNumber,
                this.stage,
                this.role,
                this.source,
                this.content,
                this.mediaUrl,
                this.personaId,
                this.difficultyLevel);
    }

    public void updateMediaUrl(String mediaUrl) {
        this.mediaUrl = mediaUrl;
    }
}
