package me.unbrdn.core.resume.domain.entity;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import me.unbrdn.core.common.domain.BaseTimeEntity;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Resumes extends BaseTimeEntity {

    private java.util.UUID userId;

    private String title;

    private String content;

    private String fileHash;

    private String filePath;

    private ResumeStatus status;

    private String imageUrls;

    private String vectorStatus;

    public static Resumes create(
            java.util.UUID userId, String title, String filePath, String fileHash) {
        return Resumes.builder()
                .userId(userId)
                .title(title)
                .filePath(filePath)
                .fileHash(fileHash)
                .status(ResumeStatus.PENDING)
                .build();
    }

    public void startProcessing() {
        this.status = ResumeStatus.PROCESSING;
    }

    public void completeProcessing(String content, String imageUrls) {
        this.content = content;
        this.imageUrls = imageUrls;
        this.status = ResumeStatus.COMPLETED;
    }

    public void failProcessing() {
        this.status = ResumeStatus.FAILED;
    }

    public void updateVectorStatus(String vectorStatus) {
        this.vectorStatus = vectorStatus;
    }

    /**
     * 이력서 내용 업데이트 (파일 교체)
     *
     * @param title 새 제목
     * @param filePath 새 파일 경로
     * @param content 새 텍스트 내용
     */
    public void updateContent(String title, String filePath, String content) {
        this.title = title;
        this.filePath = filePath;
        this.content = content;
        this.status = ResumeStatus.COMPLETED;
    }

    public void setFileHash(String fileHash) {
        this.fileHash = fileHash;
    }
}
