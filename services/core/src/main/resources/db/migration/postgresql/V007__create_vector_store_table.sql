-- Spring AI PgVector Store 테이블 생성
CREATE TABLE IF NOT EXISTS vector_store (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT,
    metadata JSONB,
    embedding vector(384)  -- paraphrase-multilingual-MiniLM-L12-v2 차원
);

-- HNSW 인덱스 생성 (유사도 검색 성능 향상)
CREATE INDEX IF NOT EXISTS vector_store_embedding_idx 
ON vector_store USING hnsw (embedding vector_cosine_ops);

-- 메타데이터 검색용 인덱스
CREATE INDEX IF NOT EXISTS vector_store_metadata_idx 
ON vector_store USING gin (metadata);

-- 기존 resume_embeddings 테이블 데이터 이관 (선택적)
-- INSERT INTO vector_store (content, metadata, embedding)
-- SELECT 
--     content,
--     jsonb_build_object('resumeId', resume_id, 'category', category),
--     embedding
-- FROM resume_embeddings
-- WHERE embedding IS NOT NULL;
