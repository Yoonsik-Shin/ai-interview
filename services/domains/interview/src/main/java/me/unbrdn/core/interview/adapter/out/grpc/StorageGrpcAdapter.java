package me.unbrdn.core.interview.adapter.out.grpc;

import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.grpc.storage.v1.GetPresignedUrlRequest;
import me.unbrdn.core.grpc.storage.v1.GetPresignedUrlResponse;
import me.unbrdn.core.grpc.storage.v1.StorageServiceGrpc;
import me.unbrdn.core.interview.application.port.out.GetSegmentStorageUrlPort;
import net.devh.boot.grpc.client.inject.GrpcClient;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class StorageGrpcAdapter implements GetSegmentStorageUrlPort {

    @GrpcClient("storage-service")
    private StorageServiceGrpc.StorageServiceBlockingStub storageStub;

    @Override
    public String getUploadUrl(String objectKey, int expirationSeconds) {
        return getPresignedUrl(objectKey, "put_object", expirationSeconds, false);
    }

    @Override
    public String getDownloadUrl(String objectKey, int expirationSeconds) {
        return getPresignedUrl(objectKey, "get_object", expirationSeconds, false);
    }

    private String getPresignedUrl(
            String objectKey, String method, int expirationSeconds, boolean internalAccess) {
        try {
            GetPresignedUrlRequest request =
                    GetPresignedUrlRequest.newBuilder()
                            .setObjectKey(objectKey)
                            .setMethod(method)
                            .setExpirationSec(expirationSeconds)
                            .setInternalAccess(internalAccess)
                            .build();

            GetPresignedUrlResponse response = storageStub.getPresignedUrl(request);
            return response.getUrl();
        } catch (Exception e) {
            log.error(
                    "Failed to generate presigned URL via gRPC (method={}, key={}): {}",
                    method,
                    objectKey,
                    e.getMessage());
            return null;
        }
    }
}
