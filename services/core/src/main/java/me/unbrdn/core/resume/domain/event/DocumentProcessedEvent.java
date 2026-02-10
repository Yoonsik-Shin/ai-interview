package me.unbrdn.core.resume.domain.event;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class DocumentProcessedEvent {
    private String resumeId;
    private String status;
    private String content;
    private List<Float> embedding; // RAG embedding (summary)
    private List<Float> validationEmbedding; // Duplicate check embedding
    private List<ResumeChunk> chunks; // Chunked embeddings for RAG
    private List<String> imageUrls;
    private Object images;
    private String vectorStatus;
    private String error;

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @ToString
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ResumeChunk {
        private String content;
        private List<Float> embedding;
        private String category;
        private Integer pageNum;
        private String chunkType;
    }
}
