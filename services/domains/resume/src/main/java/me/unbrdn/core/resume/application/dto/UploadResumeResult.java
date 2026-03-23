package me.unbrdn.core.resume.application.dto;

import java.util.Optional;
import lombok.Getter;
import me.unbrdn.core.resume.application.service.ResumeVectorService.SimilarResumeResult;

/** 이력서 업로드 결과 */
@Getter
public class UploadResumeResult {
    private final String resumeId;
    private final SimilarResumeResult similarResume;
    private final boolean hasSimilarResume;

    private UploadResumeResult(String resumeId, SimilarResumeResult similarResume) {
        this.resumeId = resumeId;
        this.similarResume = similarResume;
        this.hasSimilarResume = similarResume != null;
    }

    /** 정상 업로드 성공 */
    public static UploadResumeResult success(String resumeId) {
        return new UploadResumeResult(resumeId, null);
    }

    /** 유사 이력서 발견 */
    public static UploadResumeResult withSimilarResume(SimilarResumeResult similarResume) {
        return new UploadResumeResult(null, similarResume);
    }

    public Optional<SimilarResumeResult> getSimilarResumeOptional() {
        return Optional.ofNullable(similarResume);
    }
}
