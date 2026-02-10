package me.unbrdn.core.resume.domain.entity;

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
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.user.domain.entity.User;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes; // Keep SqlTypes for UUID if needed, but vector uses are gone.

// actually SqlTypes is used for JSON, let's check

@Entity
@Table(name = "resumes")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Resumes extends BaseTimeEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "file_hash", length = 64)
    private String fileHash;

    @Column(name = "file_path", length = 500)
    private String filePath;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ResumeStatus status;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "image_urls", columnDefinition = "JSONB")
    private String imageUrls;

    @Column(name = "vector_status", length = 20)
    private String vectorStatus;

    private Resumes(User user, String title, String filePath, String fileHash) {
        this.user = user;
        this.title = title;
        this.filePath = filePath;
        this.fileHash = fileHash;
        this.status = ResumeStatus.PENDING;
    }

    public static Resumes create(User user, String title, String filePath, String fileHash) {
        return new Resumes(user, title, filePath, fileHash);
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

    // Embedding field removed in favor of ResumeEmbedding entity via 1:N relation.
    // public void setEmbedding(float[] embedding) { ... }

    public void setFileHash(String fileHash) {
        this.fileHash = fileHash;
    }
}
