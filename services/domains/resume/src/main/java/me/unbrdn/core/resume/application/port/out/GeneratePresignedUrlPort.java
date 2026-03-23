package me.unbrdn.core.resume.application.port.out;

public interface GeneratePresignedUrlPort {
    String generateUploadUrl(String objectKey);

    String generateDownloadUrl(String objectKey, boolean internalAccess);
}
