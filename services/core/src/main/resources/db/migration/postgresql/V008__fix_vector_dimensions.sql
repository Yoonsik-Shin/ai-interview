-- 기존 1536차원 테이블 삭제 (mismatch 해결)
DROP TABLE IF EXISTS vector_store CASCADE;

-- 384차원으로 재생성 (document 서비스의 로컬 모델과 일치)
CREATE TABLE vector_store (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT,
    metadata JSONB,
    embedding vector(384)
);

-- 인덱스 재생성
CREATE INDEX vector_store_embedding_idx 
ON vector_store USING hnsw (embedding vector_cosine_ops);

CREATE INDEX vector_store_metadata_idx 
ON vector_store USING gin (metadata);

-- resume_embeddings 테이블도 차원 수정
ALTER TABLE resume_embeddings ALTER COLUMN embedding TYPE vector(384);
