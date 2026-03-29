package me.unbrdn.core.interview.domain.entity;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.interview.domain.enums.InterviewStage;
import me.unbrdn.core.interview.domain.enums.MessageRole;
import me.unbrdn.core.interview.domain.enums.MessageSource;

@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InterviewMessage extends BaseTimeEntity {

    private InterviewSession interview;
    private Integer turnCount;
    private Integer sequenceNumber;
    private InterviewStage stage;
    private MessageRole role;
    private MessageSource source;
    private String content;
    private String mediaUrl;
    private String personaId;
    private Integer difficultyLevel;

    public static InterviewMessage create(
            InterviewSession interview,
            Integer turnCount,
            Integer sequenceNumber,
            InterviewStage stage,
            MessageRole role,
            MessageSource source,
            String content,
            String mediaUrl,
            String personaId,
            Integer difficultyLevel) {

        return InterviewMessage.builder()
                .interview(interview)
                .turnCount(turnCount)
                .sequenceNumber(sequenceNumber)
                .stage(stage)
                .role(role)
                .source(source)
                .content(content)
                .mediaUrl(mediaUrl)
                .personaId(personaId)
                .difficultyLevel(difficultyLevel)
                .build();
    }

    public void updateMediaUrl(String mediaUrl) {
        this.mediaUrl = mediaUrl;
    }
}
