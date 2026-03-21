package me.unbrdn.core.interview.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.interview.domain.enums.InterviewStage;
import me.unbrdn.core.interview.domain.enums.MessageRole;

@Entity
@Table(name = "interview_messages")
@Getter
// Append-Only 테이블이므로 @Setter는 의도적으로 제외하여 불변성(Immutability)을 보장합니다.
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InterviewMessage extends BaseTimeEntity {

    // Inherits ID from BaseTimeEntity -> BaseEntity

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "interview_session_id", nullable = false)
    private InterviewSession interview;

    @Column(nullable = false)
    private Integer turnCount;

    @Column(nullable = false)
    private Integer sequenceNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private InterviewStage stage;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MessageRole role;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(length = 1000)
    private String mediaUrl; // STT 원본 오디오 링크 또는 TTS 생성 오디오 링크

    /** 정적 팩토리 메서드: 새로운 메시지(청크)를 DB에 기록할 때 사용합니다. */
    public static InterviewMessage create(
            InterviewSession interview,
            Integer turnCount,
            Integer sequenceNumber,
            InterviewStage stage,
            MessageRole role,
            String content,
            String mediaUrl) {

        return InterviewMessage.builder()
                .interview(interview)
                .turnCount(turnCount)
                .sequenceNumber(sequenceNumber)
                .stage(stage)
                .role(role)
                .content(content)
                .mediaUrl(mediaUrl)
                .build();
    }

    /** TTS/STT 파일이 나중에 비동기로 업로드 완료되었을 때 URL만 업데이트하는 예외적 메서드 */
    public void updateMediaUrl(String mediaUrl) {
        this.mediaUrl = mediaUrl;
    }
}
