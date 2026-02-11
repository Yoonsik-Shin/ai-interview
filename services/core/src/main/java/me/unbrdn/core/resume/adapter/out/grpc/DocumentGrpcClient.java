package me.unbrdn.core.resume.adapter.out.grpc;

import io.grpc.StatusRuntimeException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.grpc.document.v1.DocumentServiceGrpc;
import me.unbrdn.core.grpc.document.v1.GenerateEmbeddingRequest;
import me.unbrdn.core.grpc.document.v1.GenerateEmbeddingResponse;
import net.devh.boot.grpc.client.inject.GrpcClient;
import org.springframework.stereotype.Component;

/** Document 서비스 gRPC 클라이언트 어댑터 */
@Slf4j
@Component
public class DocumentGrpcClient {

    @GrpcClient("document-service")
    private DocumentServiceGrpc.DocumentServiceBlockingStub documentServiceStub;

    /**
     * 텍스트를 임베딩 벡터로 변환
     *
     * @param text 임베딩할 텍스트
     * @return 임베딩 벡터 (float 배열)
     */
    public float[] generateEmbedding(String text) {
        try {
            log.info("Document 서비스에 임베딩 생성 요청: textLength={}", text.length());

            GenerateEmbeddingRequest request =
                    GenerateEmbeddingRequest.newBuilder().setText(text).build();

            GenerateEmbeddingResponse response = documentServiceStub.generateEmbedding(request);

            List<Float> embeddingList = response.getEmbeddingList();
            float[] embedding = new float[embeddingList.size()];
            for (int i = 0; i < embeddingList.size(); i++) {
                embedding[i] = embeddingList.get(i);
            }

            log.info("임베딩 생성 완료: dimension={}", response.getDimension());
            return embedding;

        } catch (StatusRuntimeException e) {
            log.error("Document 서비스 gRPC 호출 실패: {}", e.getStatus(), e);
            throw new RuntimeException("임베딩 생성 실패: " + e.getStatus().getDescription(), e);
        }
    }
}
