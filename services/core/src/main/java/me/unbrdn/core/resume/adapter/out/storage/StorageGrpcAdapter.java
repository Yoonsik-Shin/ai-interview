package me.unbrdn.core.resume.adapter.out.storage;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.grpc.storage.v1.DeleteObjectRequest;
import me.unbrdn.core.grpc.storage.v1.DeleteObjectResponse;
import me.unbrdn.core.grpc.storage.v1.GetPresignedUrlRequest;
import me.unbrdn.core.grpc.storage.v1.GetPresignedUrlResponse;
import me.unbrdn.core.grpc.storage.v1.StorageServiceGrpc;
import me.unbrdn.core.resume.application.port.out.DeleteFilePort;
import me.unbrdn.core.resume.application.port.out.GeneratePresignedUrlPort;
import net.devh.boot.grpc.client.inject.GrpcClient;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class StorageGrpcAdapter implements GeneratePresignedUrlPort, DeleteFilePort {

    @GrpcClient("storage-service")
    private StorageServiceGrpc.StorageServiceBlockingStub storageStub;

    @Override
    public String generateUploadUrl(String objectKey) {
        return getPresignedUrl(objectKey, "put_object");
    }

    @Override
    public String generateDownloadUrl(String objectKey) {
        return getPresignedUrl(objectKey, "get_object");
    }

    private String getPresignedUrl(String objectKey, String method) {
        try {
            GetPresignedUrlRequest request =
                    GetPresignedUrlRequest.newBuilder()
                            .setObjectKey(objectKey)
                            .setMethod(method)
                            .setExpirationSec(3600)
                            .build();

            GetPresignedUrlResponse response = storageStub.getPresignedUrl(request);
            return response.getUrl();
        } catch (Exception e) {
            log.error("Failed to generate presigned URL via gRPC ({}): {}", method, e.getMessage());
            return null;
        }
    }

    @Override
    public void deleteFile(String filePath) {
        try {
            DeleteObjectRequest request =
                    DeleteObjectRequest.newBuilder().setObjectKey(filePath).build();

            DeleteObjectResponse response = storageStub.deleteObject(request);
            if (response.getSuccess()) {
                log.info("Storage file deleted via gRPC: {}", filePath);
            } else {
                log.error(
                        "Failed to delete file from storage via gRPC ({}): {}",
                        filePath,
                        response.getMessage());
            }
        } catch (Exception e) {
            log.error("Failed to call deleteObject gRPC ({}): {}", filePath, e.getMessage());
        }
    }
}
