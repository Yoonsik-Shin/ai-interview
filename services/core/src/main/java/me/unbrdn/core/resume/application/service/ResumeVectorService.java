package me.unbrdn.core.resume.application.service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class ResumeVectorService {
    private final VectorStore vectorStore;
    private final JdbcTemplate jdbcTemplate;

    /**
     * 이력서 임베딩 저장
     *
     * @param userId 사용자 ID
     * @param resumeId 이력서 ID (메타데이터로 저장)
     * @param content 원본 텍스트
     * @param embedding 임베딩 벡터
     * @param category 카테고리 (예: "experience", "education")
     */
    public void saveEmbedding(
            UUID userId, String resumeId, String content, float[] embedding, String category) {
        saveEmbedding(userId, resumeId, content, embedding, category, null);
    }

    public void saveEmbedding(
            UUID userId,
            String resumeId,
            String content,
            float[] embedding,
            String category,
            Integer pageNum) {
        // Spring AI의 VectorStore.add()는 임베딩을 다시 계산하려 할 수 있으므로
        // 미리 계산된 임베딩이 있는 경우 JdbcTemplate으로 직접 저장합니다.
        String metadataJson;
        if (pageNum != null) {
            metadataJson =
                    String.format(
                            "{\"userId\": \"%s\", \"resumeId\": \"%s\", \"category\": \"%s\", \"pageNum\": %d, \"timestamp\": \"%s\"}",
                            userId.toString(),
                            resumeId,
                            category,
                            pageNum,
                            Instant.now().toString());
        } else {
            metadataJson =
                    String.format(
                            "{\"userId\": \"%s\", \"resumeId\": \"%s\", \"category\": \"%s\", \"timestamp\": \"%s\"}",
                            userId.toString(), resumeId, category, Instant.now().toString());
        }

        jdbcTemplate.update(
                "INSERT INTO vector_store (id, content, metadata, embedding) VALUES (gen_random_uuid(), ?, ?::jsonb, ?::vector)",
                content,
                metadataJson,
                embedding);

        log.info(
                "임베딩 저장 완료: userId={}, resumeId={}, category={}, page={}",
                userId,
                resumeId,
                category,
                pageNum);
    }

    /**
     * 유사 이력서 검색 (중복 체크)
     *
     * @param userId 사용자 ID
     * @param queryEmbedding 검색할 임베딩 벡터
     * @param threshold 유사도 임계값 (기본 0.85)
     * @return 유사한 이력서 정보 (없으면 Optional.empty())
     */
    public Optional<SimilarResumeResult> findSimilarResume(
            UUID userId, float[] queryEmbedding, double threshold) {
        log.info("유사도 검색 시작: userId={}, threshold={}", userId, threshold);

        // PostgreSQL의 pgvector를 사용한 코사인 유사도 검색
        // 1 - (embedding <=> query) = 코사인 유사도
        String sql =
                """
                SELECT
                    vs.metadata->>'resumeId' as resume_id,
                    1 - (vs.embedding <=> ?::vector) as similarity,
                    r.title,
                    r.created_at
                FROM vector_store vs
                JOIN resumes r ON r.id::text = vs.metadata->>'resumeId'
                WHERE vs.metadata->>'userId' = ?
                AND vs.metadata->>'category' = 'VALIDATION'
                AND 1 - (vs.embedding <=> ?::vector) > ?
                ORDER BY similarity DESC
                LIMIT 1
                """;

        List<Map<String, Object>> results =
                jdbcTemplate.queryForList(
                        sql, queryEmbedding, userId.toString(), queryEmbedding, threshold);

        if (!results.isEmpty()) {
            Map<String, Object> row = results.get(0);
            double similarity = ((Number) row.get("similarity")).doubleValue();
            String resumeId = (String) row.get("resume_id");
            String title = (String) row.get("title");
            Object createdAt = row.get("created_at");

            log.info(
                    "유사한 이력서 발견: userId={}, resumeId={}, similarity={}",
                    userId,
                    resumeId,
                    similarity);

            return Optional.of(
                    new SimilarResumeResult(resumeId, similarity, title, createdAt.toString()));
        }

        log.info("유사한 이력서 없음: userId={}", userId);
        return Optional.empty();
    }

    /** 유사 이력서 검색 결과 */
    public record SimilarResumeResult(
            String resumeId, double similarity, String title, String uploadedAt) {}

    /**
     * 유사 이력서 검색
     *
     * @param queryEmbedding 검색할 임베딩 벡터
     * @param topK 상위 K개 결과
     * @return 유사도 높은 문서 리스트
     */
    public List<Document> searchSimilar(float[] queryEmbedding, int topK) {
        SearchRequest request = SearchRequest.query("").withTopK(topK).withSimilarityThreshold(0.7);

        return vectorStore.similaritySearch(request);
    }

    /**
     * 특정 이력서의 모든 임베딩 삭제
     *
     * @param resumeId 이력서 ID
     */
    public void deleteByResumeId(String resumeId) {
        jdbcTemplate.update("DELETE FROM vector_store WHERE metadata->>'resumeId' = ?", resumeId);
        log.info("임베딩 삭제 완료: resumeId={}", resumeId);
    }

    /**
     * 사용자별 모든 이력서 임베딩 조회
     *
     * @param userId 사용자 ID
     * @return 이력서 ID -> 임베딩 벡터 Map
     */
    public Map<UUID, float[]> getEmbeddingsByUserId(UUID userId) {
        String sql =
                """
                SELECT
                    metadata->>'resumeId' as resume_id,
                    embedding
                FROM vector_store
                WHERE metadata->>'userId' = ?
                AND metadata->>'category' = 'VALIDATION'
                """;

        List<Map<String, Object>> results = jdbcTemplate.queryForList(sql, userId.toString());

        return results.stream()
                .collect(
                        java.util.stream.Collectors.toMap(
                                row -> UUID.fromString((String) row.get("resume_id")),
                                row -> {
                                    Object embeddingObj = row.get("embedding");
                                    return parseEmbedding(embeddingObj);
                                },
                                (existing, replacement) -> existing)); // Duplicate key strategy
    }

    private float[] parseEmbedding(Object embeddingObj) {
        if (embeddingObj instanceof org.postgresql.util.PGobject) {
            String val = ((org.postgresql.util.PGobject) embeddingObj).getValue();
            // "[0.1, 0.2, ...]" 형태 파싱
            if (val != null && val.startsWith("[") && val.endsWith("]")) {
                String[] parts = val.substring(1, val.length() - 1).split(",");
                float[] vector = new float[parts.length];
                try {
                    for (int i = 0; i < parts.length; i++) {
                        vector[i] = Float.parseFloat(parts[i].trim());
                    }
                    return vector;
                } catch (NumberFormatException e) {
                    log.error("Embedding parsing error: {}", e.getMessage());
                }
            }
        }
        return new float[0];
    }
}
