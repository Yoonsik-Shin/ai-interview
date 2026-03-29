package me.unbrdn.core.interview.domain.entity;

import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.interview.domain.enums.SegmentAnalysisStatus;

@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InterviewRecordingSegment extends BaseTimeEntity {

    private InterviewSession interviewSession;
    private Integer turnCount;
    private String objectKey;
    private Integer durationSeconds;
    private Instant startedAt;
    private Instant endedAt;
    private SegmentAnalysisStatus analysisStatus;

    public static InterviewRecordingSegment create(
            InterviewSession interviewSession,
            Integer turnCount,
            String objectKey,
            Integer durationSeconds,
            Instant startedAt,
            Instant endedAt) {
        return InterviewRecordingSegment.builder()
                .interviewSession(interviewSession)
                .turnCount(turnCount)
                .objectKey(objectKey)
                .durationSeconds(durationSeconds)
                .startedAt(startedAt)
                .endedAt(endedAt)
                .analysisStatus(SegmentAnalysisStatus.PENDING)
                .build();
    }

    public void updateDetails(
            String objectKey, Integer durationSeconds, Instant startedAt, Instant endedAt) {
        this.objectKey = objectKey;
        this.durationSeconds = durationSeconds;
        this.startedAt = startedAt;
        this.endedAt = endedAt;
        this.analysisStatus = SegmentAnalysisStatus.PENDING;
    }
}
