package me.unbrdn.core.config;

import java.util.List;
import org.springframework.ai.document.Document;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.embedding.EmbeddingRequest;
import org.springframework.ai.embedding.EmbeddingResponse;
import org.springframework.ai.vectorstore.PgVectorStore;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
public class VectorStoreConfig {

    /** Dummy EmbeddingModel for VectorStore 실제 임베딩은 외부(document 서비스)에서 생성되어 제공됨 */
    @Bean
    public EmbeddingModel dummyEmbeddingModel(
            @Value("${spring.ai.vectorstore.pgvector.dimensions:1536}") int dimensions) {
        return new EmbeddingModel() {
            @Override
            public EmbeddingResponse call(EmbeddingRequest request) {
                // Placeholder: 런타임 에러 방지를 위해 빈 결과 대신 기본 벡터 반환
                // 실제 임베딩은 외부에서 제공되지만, VectorStore가 내부적으로 호출할 경우를 대비
                return new EmbeddingResponse(
                        List.of(
                                new org.springframework.ai.embedding.Embedding(
                                        new float[dimensions], 0)));
            }

            @Override
            public int dimensions() {
                return dimensions;
            }

            @Override
            public float[] embed(String text) {
                // Placeholder: 실제로는 사용되지 않음
                return new float[dimensions];
            }

            @Override
            public float[] embed(Document document) {
                // Placeholder: 실제로는 사용되지 않음
                return new float[dimensions];
            }

            @Override
            public List<float[]> embed(List<String> texts) {
                // Placeholder: 실제로는 사용되지 않음
                return List.of();
            }
        };
    }

    @Bean
    @Profile("local")
    public VectorStore pgVectorStore(
            JdbcTemplate jdbcTemplate,
            EmbeddingModel embeddingModel,
            @Value("${spring.ai.vectorstore.pgvector.dimensions:1536}") int dimensions) {

        // Flyway가 가끔 문제를 일으키거나 특정 환경에서 누락될 수 있으므로
        // JdbcTemplate으로 테이블 존재 여부 확인 후 직접 생성 시도 (안전 장치)
        jdbcTemplate.execute("CREATE EXTENSION IF NOT EXISTS vector");

        // 차원 불일치 해결을 위한 강력한 체크: 기존 테이블이 있고 차원이 다르면 삭제 후 재생성
        try {
            jdbcTemplate.execute(
                    String.format(
                            "DO $$ "
                                    + "BEGIN "
                                    + "    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vector_store') THEN "
                                    + "        IF (SELECT atttypmod FROM pg_attribute WHERE attrelid = 'vector_store'::regclass AND attname = 'embedding') <> %d THEN "
                                    + "            DROP TABLE vector_store CASCADE; "
                                    + "        END IF; "
                                    + "    END IF; "
                                    + "END $$;",
                            dimensions));
        } catch (Exception e) {
            // 무시 (테이블이 없거나 권한 문제 등)
        }

        jdbcTemplate.execute(
                String.format(
                        "CREATE TABLE IF NOT EXISTS vector_store ("
                                + "id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "
                                + "content TEXT, "
                                + "metadata JSONB, "
                                + "embedding vector(%d))",
                        dimensions));
        jdbcTemplate.execute(
                "CREATE INDEX IF NOT EXISTS vector_store_embedding_idx ON vector_store USING hnsw (embedding vector_cosine_ops)");

        return new PgVectorStore.Builder(jdbcTemplate, embeddingModel)
                .withDimensions(dimensions)
                .withDistanceType(PgVectorStore.PgDistanceType.COSINE_DISTANCE)
                .withIndexType(PgVectorStore.PgIndexType.HNSW)
                .withInitializeSchema(false) // 위에서 직접 관리
                .build();
    }

    // 추후 프로덕션용 Oracle VectorStore 추가
    // @Bean
    // @Profile("prod")
    // public VectorStore oracleVectorStore(JdbcTemplate jdbcTemplate,
    // EmbeddingModel
    // embeddingModel) {
    // return new OracleVectorStore.Builder(jdbcTemplate, embeddingModel)
    // .withDimensions(1536)
    // .withDistanceType(OracleVectorStore.DistanceType.COSINE)
    // .build();
    // }
}
