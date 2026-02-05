package me.unbrdn.core.interview.domain.model;

import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** 면접 진행 중 빈번하게 변경되는 세션의 '뜨거운(Hot)' 상태를 관리하는 객체. Redis Hash에 저장되어 빠른 읽기/쓰기를 지원합니다. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InterviewSessionState implements Serializable {
    private static final long serialVersionUID = 1L;

    private Integer currentDifficulty;
    private String lastInterviewerId;
    private Integer turnCount;
    private Long remainingTimeSeconds;

    // Sequential Intro fields
    private java.util.List<String> participatingPersonas;
    private Integer nextPersonaIndex;
    private Integer selfIntroRetryCount;

    public static InterviewSessionState createDefault() {
        return InterviewSessionState.builder()
                .currentDifficulty(3) // 기본값 3
                .turnCount(0)
                .build();
    }
}
